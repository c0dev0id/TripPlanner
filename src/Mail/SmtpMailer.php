<?php

declare(strict_types=1);

namespace Planner\Mail;

use PHPMailer\PHPMailer\PHPMailer;
use Planner\Config;

/** Hands mail to the local smtpd without authentication or TLS. */
final class SmtpMailer implements Mailer
{
    public function __construct(private readonly Config $config)
    {
    }

    public function send(string $to, string $subject, string $body): void
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $this->config->smtpHost;
        $mail->Port = $this->config->smtpPort;
        $mail->SMTPAuth = false;
        $mail->SMTPAutoTLS = false;
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->setFrom($this->config->mailFrom, $this->config->mailFromName);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->send();
    }
}
