import QRCode from "qrcode";

export async function generateQRLabel({ qrContent, codigoActivo, rubro, tipoRubro, fecha }) {
  const W = 600;
  const H = 300;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const leftBox = { x: 5, y: 5, w: 355, h: 290 };
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(leftBox.x, leftBox.y, leftBox.w, leftBox.h);
  ctx.setLineDash([]);

  const cx = leftBox.x + leftBox.w / 2;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = "bold 18px sans-serif";
  ctx.fillText("ORGANO JUDICIAL", cx, leftBox.y + 8);

  const qrSize = 160;
  const qrX = cx - qrSize / 2;
  const qrY = 35;

  const tempCanvas = document.createElement("canvas");
  await QRCode.toCanvas(tempCanvas, qrContent, { width: qrSize, margin: 1 });
  ctx.drawImage(tempCanvas, qrX, qrY, qrSize, qrSize);

  const txtSize = 16;
  const codeY = qrY + qrSize + 6;
  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText(codigoActivo, cx, codeY);

  const dashY = codeY + 19;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(leftBox.x + 10, dashY);
  ctx.lineTo(leftBox.x + leftBox.w - 10, dashY);
  ctx.stroke();
  ctx.setLineDash([]);

  const rubY = dashY + 8;
  const tipY = rubY + 20;
  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText(rubro, cx, rubY);
  ctx.font = `${txtSize}px Arial`;
  ctx.fillText(tipoRubro, cx, tipY);

  ctx.font = `${txtSize}px Arial`;
  ctx.fillText("www.auditores-mj.com", cx, tipY + 21);

  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = "/DiosaReal.png";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  const rightX = 360;
  const rightW = 240;
  const imgH = 260;
  ctx.drawImage(img, rightX, 0, rightW, imgH);

  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText(fecha, rightX + rightW / 2, imgH + 6);

  return canvas.toDataURL("image/png");
}
