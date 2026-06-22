// Entry untuk mem-bundle paket `qrcode` menjadi build browser (global window.QRCode).
// Regenerasi: npm run build:qr
import QRCode from 'qrcode';
window.QRCode = QRCode;
