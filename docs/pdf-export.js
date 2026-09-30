'use strict';

// A single-page, print-size PDF containing the same raster artwork as the PNG.
// The PDF itself carries the physical size; JPEG is used only as its internal image stream.
const PdfExport = (() => {
  const encoder = new TextEncoder();
  const pagePoints = 12 * 72;
  const encode = value => encoder.encode(value);

  async function fromJpeg(jpeg, pixelSize) {
    if (!jpeg || jpeg.type !== 'image/jpeg' || !Number.isInteger(pixelSize) || pixelSize < 1)
      throw new Error('PDFに埋め込む画像が不正です。');
    const image = new Uint8Array(await jpeg.arrayBuffer());
    if (image[0] !== 0xff || image[1] !== 0xd8)
      throw new Error('JPEG画像を読み取れませんでした。');

    const parts = [];
    const offsets = [0];
    let length = 0;
    const append = part => {
      const bytes = typeof part === 'string' ? encode(part) : part;
      parts.push(bytes);
      length += bytes.byteLength;
    };
    const object = (id, body) => {
      offsets[id] = length;
      append(`${id} 0 obj\n`);
      append(body);
      append('\nendobj\n');
    };

    append('%PDF-1.4\n%\x80\x81\x82\x83\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagePoints} ${pagePoints}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
    const instructions = `q\n${pagePoints} 0 0 ${pagePoints} 0 0 cm\n/Im0 Do\nQ\n`;
    object(4, `<< /Length ${encode(instructions).byteLength} >>\nstream\n${instructions}endstream`);
    offsets[5] = length;
    append('5 0 obj\n');
    append(`<< /Type /XObject /Subtype /Image /Width ${pixelSize} /Height ${pixelSize} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.byteLength} >>\nstream\n`);
    append(image);
    append('\nendstream\nendobj\n');

    const xref = length;
    append('xref\n0 6\n0000000000 65535 f \n');
    for (let id = 1; id <= 5; id++) append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
    append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  return { fromJpeg };
})();
