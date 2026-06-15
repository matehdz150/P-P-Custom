import { Injectable, Inject } from "@nestjs/common";
import { Resend } from "resend";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EmailsService {
  private resend: Resend;
  private fromEmail: string;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY") || "";
    this.fromEmail = this.configService.get<string>("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    this.resend = new Resend(apiKey);
  }

  async sendOrderConfirmation(
    toEmail: string,
    details: {
      orderId: string;
      productName: string;
      quantity: number;
      totalPrice: string;
    }
  ) {
    const subject = `Confirmación de tu Pedido #${details.orderId.substring(0, 8).toUpperCase()}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmación de Pedido</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 0;
            color: #333333;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          }
          .header {
            background: linear-gradient(135deg, #4F46E5, #3B82F6);
            color: #ffffff;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 700;
          }
          .content {
            padding: 30px 40px;
          }
          .welcome-text {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .details-card {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 24px;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 14px;
          }
          .details-row:last-child {
            margin-bottom: 0;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
            font-weight: bold;
            font-size: 16px;
          }
          .label {
            color: #6b7280;
          }
          .value {
            color: #111827;
            text-align: right;
          }
          .footer {
            background-color: #f9fafb;
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Gracias por tu pedido!</h1>
          </div>
          <div class="content">
            <p class="welcome-text">Hola,</p>
            <p class="welcome-text">Hemos recibido tu pedido y ya está siendo procesado por el proveedor. A continuación, encontrarás los detalles de tu compra:</p>
            
            <div class="details-card">
              <div class="details-row">
                <span class="label">Pedido ID:</span>
                <span class="value">#${details.orderId.toUpperCase()}</span>
              </div>
              <div class="details-row">
                <span class="label">Producto:</span>
                <span class="value">${details.productName}</span>
              </div>
              <div class="details-row">
                <span class="label">Cantidad:</span>
                <span class="value">${details.quantity}</span>
              </div>
              <div class="details-row">
                <span class="label">Total:</span>
                <span class="value">$${details.totalPrice} MXN</span>
              </div>
            </div>

            <p class="welcome-text" style="margin-top: 30px;">Te mantendremos informado sobre las actualizaciones del estado de tu envío.</p>
          </div>
          <div class="footer">
            Este es un correo automático, por favor no respondas a este mensaje.<br>
            &copy; ${new Date().getFullYear()} P-P-Custom. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      ¡Gracias por tu pedido!
      
      Hemos recibido tu pedido y ya está siendo procesado. A continuación los detalles:
      - Pedido ID: #${details.orderId.toUpperCase()}
      - Producto: ${details.productName}
      - Cantidad: ${details.quantity}
      - Total: $${details.totalPrice} MXN
      
      Te notificaremos en cuanto el estado cambie.
    `;

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: toEmail,
        subject: subject,
        html: htmlBody,
        text: textBody,
      });

      if (response.error) {
        throw response.error;
      }
    } catch (error) {
      console.error("Error sending order confirmation email via Resend:", error);
    }
  }
}
