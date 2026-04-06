import {
  Html, Head, Body, Container, Section, Text, Hr,
} from '@react-email/components';

interface LeadNotificationProps {
  name: string;
  email: string;
  company: string;
  message: string;
  ts: string;
}

export default function LeadNotification({ name, email, company, message, ts }: LeadNotificationProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f4f4f5', padding: '40px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', backgroundColor: '#fff', borderRadius: 12, padding: '32px 40px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#004090', fontWeight: 700 }}>
            New Lead
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '8px 0 4px' }}>
            {name}
          </Text>
          <Text style={{ fontSize: 14, color: '#71717a', margin: '0 0 16px' }}>
            {email}{company ? ` — ${company}` : ''}
          </Text>
          {message && (
            <>
              <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
              <Text style={{ fontSize: 14, color: '#3f3f46', lineHeight: '1.6' }}>
                {message}
              </Text>
            </>
          )}
          <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
          <Text style={{ fontSize: 11, color: '#a1a1aa' }}>
            Received {ts}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
