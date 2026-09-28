'use strict';
// Minimal ZIP reader/writer for numbered PNG files. Reading supports stored and DEFLATE entries.
// Writing uses stored entries so no third-party code or remote service is required.
const ZipFiles = (() => {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0; }
  function crc32(bytes) { let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0; }
  function view(bytes) { return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); }
  async function read(file) {
    if (file.size > 60_000_000) throw new Error('ZIPは60MB以下にしてください。');
    const bytes=new Uint8Array(await file.arrayBuffer()),v=view(bytes);
    let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)
      if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
    if(eocd<0)throw new Error('ZIPの末尾情報を読み取れません。');
    const count=v.getUint16(eocd+10,true),dirOffset=v.getUint32(eocd+16,true);
    if(count>100||dirOffset>=bytes.length)throw new Error('ZIPの内容が多すぎるか、形式が対応外です。');
    const output={};let pos=dirOffset,total=0;
    for(let i=0;i<count;i++) {
      if(pos+46>bytes.length||v.getUint32(pos,true)!==0x02014b50)throw new Error('ZIPの目次が壊れています。');
      const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true);
      const compressed=v.getUint32(pos+20,true),raw=v.getUint32(pos+24,true);
      const nameLen=v.getUint16(pos+28,true),extraLen=v.getUint16(pos+30,true),commentLen=v.getUint16(pos+32,true);
      const local=v.getUint32(pos+42,true),end=pos+46+nameLen+extraLen+commentLen;
      if(end>bytes.length)throw new Error('ZIPの目次が途中で切れています。');
      const name=decoder.decode(bytes.subarray(pos+46,pos+46+nameLen));pos=end;
      if(name.endsWith('/')||name.startsWith('__MACOSX/')||name.split('/').pop().startsWith('.'))continue;
      total+=raw;
      if(raw>20_000_000||total>150_000_000)throw new Error('展開後の画像が大きすぎます。');
      if(flags&1||![0,8].includes(method))throw new Error('暗号化ZIPや特殊な圧縮形式には対応していません。');
      if(local+30>bytes.length||v.getUint32(local,true)!==0x04034b50)throw new Error('ZIPの画像データを読み取れません。');
      const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
      if(start+compressed>bytes.length)throw new Error('ZIPの画像データが途中で切れています。');
      const chunk=bytes.subarray(start,start+compressed);
      let data;
      if(method===0)data=chunk;
      else {
        if(!globalThis.DecompressionStream)throw new Error('このブラウザはZIP展開に対応していません。新しいSafariかChromeで開いてください。');
        const stream=new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        data=new Uint8Array(await new Response(stream).arrayBuffer());
      }
      if(data.length!==raw||crc32(data)!==v.getUint32(pos-(46+nameLen+extraLen+commentLen)+16,true))
        throw new Error(`ZIP内の画像が壊れています: ${name}`);
      if(Object.hasOwn(output,name))throw new Error(`ZIP内に同名ファイルがあります: ${name}`);
      output[name]=data;
    }
    return output;
  }
  function write(files) {
    const localParts=[],centralParts=[];let offset=0,number=0,centralSize=0;
    for(const [name,data] of Object.entries(files)) {
      const encoded=encoder.encode(name),length=data.length,crc=crc32(data);
      if(encoded.length>65535)throw new Error('ファイル名が長すぎます。');
      const local=new Uint8Array(30+encoded.length),lv=view(local);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);
      lv.setUint16(6,0x800,true);lv.setUint32(14,crc,true);
      lv.setUint32(18,length,true);lv.setUint32(22,length,true);
      lv.setUint16(26,encoded.length,true);local.set(encoded,30);
      const central=new Uint8Array(46+encoded.length),cv=view(central);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
      cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);
      cv.setUint32(20,length,true);cv.setUint32(24,length,true);
      cv.setUint16(28,encoded.length,true);cv.setUint32(42,offset,true);central.set(encoded,46);
      localParts.push(local,data);centralParts.push(central);
      offset+=local.length+length;centralSize+=central.length;number++;
    }
    const end=new Uint8Array(22),ev=view(end);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,number,true);ev.setUint16(10,number,true);
    ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  }
  return {read,write};
})();
