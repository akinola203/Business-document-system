import { test } from 'node:test';
import * as assert from 'node:assert';
import { MailService } from '../../src/modules/mail/mail.service';

test('MailService Unit Tests', async (t) => {
  await t.test('initializes gracefully in simulation mode when credentials are not configured', async () => {
    const mockConfig: any = {
      get: (key: string, defaultVal: any) => defaultVal,
    };

    const mailService = new MailService(mockConfig);
    mailService.onModuleInit();

    const result = await mailService.sendPasswordResetEmail(
      'staff@aoa77.com',
      'http://localhost:5173/reset-password?token=sample123',
      'Adebayo',
    );

    assert.equal(result.delivered, false);
    assert.equal(result.simulated, true);
    assert.equal(result.resetUrl, 'http://localhost:5173/reset-password?token=sample123');
  });

  await t.test('sends email successfully when transporter is configured', async () => {
    const mockConfig: any = {
      get: (key: string, defaultVal: any) => {
        if (key === 'SMTP_USER') return 'security@aoa77.com';
        if (key === 'SMTP_PASS') return 'app-password-secret';
        if (key === 'SMTP_HOST') return 'smtp.gmail.com';
        if (key === 'SMTP_PORT') return 465;
        if (key === 'SMTP_FROM') return 'AOA 77 Security <no-reply@aoa77.com>';
        return defaultVal;
      },
    };

    const mailService = new MailService(mockConfig);
    let capturedMailOptions: any = null;

    // Inject mock transporter
    (mailService as any).transporter = {
      sendMail: async (opts: any) => {
        capturedMailOptions = opts;
        return { messageId: '<msg-123@aoa77.com>' };
      },
    };
    (mailService as any).fromAddress = 'AOA 77 Security <no-reply@aoa77.com>';

    const result = await mailService.sendPasswordResetEmail(
      'director@aoa77.com',
      'http://localhost:5173/reset-password?token=token-abc',
      'Engr. Akinola',
    );

    assert.equal(result.delivered, true);
    assert.equal(result.simulated, false);
    assert.equal(result.messageId, '<msg-123@aoa77.com>');
    assert.ok(capturedMailOptions);
    assert.equal(capturedMailOptions.to, 'director@aoa77.com');
    assert.equal(capturedMailOptions.from, 'AOA 77 Security <no-reply@aoa77.com>');
    assert.equal(capturedMailOptions.subject, 'AOA 77 — Password Reset Request');
    assert.ok(capturedMailOptions.text.includes('Engr. Akinola'));
    assert.ok(capturedMailOptions.text.includes('http://localhost:5173/reset-password?token=token-abc'));
    assert.ok(capturedMailOptions.html.includes('Engr. Akinola'));
    assert.ok(capturedMailOptions.html.includes('AOA 77 &bull; SECURITY & ACCESS CONTROL'));
    assert.ok(capturedMailOptions.html.includes('http://localhost:5173/reset-password?token=token-abc'));
  });

  await t.test('handles SMTP dispatch error gracefully without throwing', async () => {
    const mockConfig: any = {
      get: (key: string, defaultVal: any) => defaultVal,
    };

    const mailService = new MailService(mockConfig);

    // Mock failing transporter
    (mailService as any).transporter = {
      sendMail: async () => {
        throw new Error('Connection refused by SMTP relay');
      },
    };

    const result = await mailService.sendPasswordResetEmail(
      'staff@aoa77.com',
      'http://localhost:5173/reset-password?token=test-token',
      'Staff Member',
    );

    assert.equal(result.delivered, false);
    assert.equal(result.simulated, true);
    assert.equal(result.error, 'Connection refused by SMTP relay');
    assert.equal(result.resetUrl, 'http://localhost:5173/reset-password?token=test-token');
  });
});
