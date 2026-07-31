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

  const leftBox = { x: 5, y: 5, w: 410, h: 290 };
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(leftBox.x, leftBox.y, leftBox.w, leftBox.h);
  ctx.setLineDash([]);

  const cx = leftBox.x + leftBox.w / 2;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = "bold 28px sans-serif";
  ctx.fillText("ORGANO JUDICIAL", cx, leftBox.y + 8);

  ctx.font = "bold 14px sans-serif";
  ctx.fillText("DAF - LA PAZ", cx, leftBox.y + 39);

  const qrSize = 145;
  const qrX = cx - qrSize / 2;
  const qrY = 60;

  const tempCanvas = document.createElement("canvas");
  await QRCode.toCanvas(tempCanvas, qrContent, { width: qrSize, margin: 1 });
  ctx.drawImage(tempCanvas, qrX, qrY, qrSize, qrSize);

  const txtSize = 15;
  const codeY = qrY + qrSize + 2;
  ctx.font = `bold 25px Arial`;
  ctx.fillText(codigoActivo, cx, codeY);

  const dashY = codeY + 27;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(leftBox.x + 10, dashY);
  ctx.lineTo(leftBox.x + leftBox.w - 10, dashY);
  ctx.stroke();
  ctx.setLineDash([]);

  const rubY = dashY + 7;
  const tipY = rubY + 16;
  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText(rubro, cx, rubY);
  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText(tipoRubro, cx, tipY);

  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText("www.auditores-mj.com", cx, tipY + 17);

  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = "/DiosaReal.png";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  const rightX = 420;
  const rightW = 180;
  const imgH = 265;
  ctx.drawImage(img, rightX, 0, rightW, imgH);

  ctx.font = `bold ${txtSize}px Arial`;
  ctx.fillText(fecha, rightX + rightW / 2, imgH + 6);

  return canvas.toDataURL("image/png");
}
