import QRCode from "qrcode";

export async function generateQRLabel({ qrContent, codigoActivo, rubro, tipo, fecha }) {
  const W = 590;
  const H = 295;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.scale(W / 600, H / 300);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 300);

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

  ctx.font = "bold 20px sans-serif";
  ctx.fillText("ORGANO JUDICIAL", cx, leftBox.y + 6);

  ctx.font = "bold 14px sans-serif";
  ctx.fillText("DAF - LA PAZ", cx, leftBox.y + 24);

  const qrY = 44;
  const codeY = 232;
  const qrSize = codeY - qrY - 4;
  const qrX = cx - qrSize / 2;

  const tempCanvas = document.createElement("canvas");
  await QRCode.toCanvas(tempCanvas, qrContent, { width: qrSize, margin: 1 });
  ctx.drawImage(tempCanvas, qrX, qrY, qrSize, qrSize);

  ctx.font = `bold 20px Arial`;
  ctx.fillText(codigoActivo, cx, codeY);

  const dashY = codeY + 24;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(leftBox.x + 10, dashY);
  ctx.lineTo(leftBox.x + leftBox.w - 10, dashY);
  ctx.stroke();
  ctx.setLineDash([]);

  const rubY = dashY + 11;
  const tipY = rubY + 20;
  const drawLine = (text, fontSize, y) => {
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(text, cx, y);
  };

  drawLine(rubro || "—", 16, rubY);
  drawLine(tipo || "—", 16, tipY);

  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = "/DiosaReal.png";
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  const rightX = 420;
  const rightW = 180;
  const imgH = 265;
  ctx.drawImage(img, rightX, 0, rightW, imgH);

  ctx.font = `bold 20px Arial`;
  ctx.fillText(fecha, rightX + rightW / 2, imgH + 6);

  return canvas.toDataURL("image/png");
}
