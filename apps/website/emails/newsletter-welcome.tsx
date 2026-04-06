import {
  Html, Head, Body, Container, Text, Button, Hr,
} from '@react-email/components';

export default function NewsletterWelcome() {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f4f4f5', padding: '40px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', backgroundColor: '#fff', borderRadius: 12, padding: '32px 40px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#004090', fontWeight: 700 }}>
            Angular Stream Resource
          </Text>
          <Text style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '12px 0 8px' }}>
            Welcome to Angular Stream Resource updates
          </Text>
          <Text style={{ fontSize: 14, color: '#3f3f46', lineHeight: '1.6', margin: '0 0 24px' }}>
            You'll receive updates on new capabilities, production patterns, and Angular agent best practices.
            We keep it focused and infrequent — no spam.
          </Text>
          <Button href="https://stream-resource.dev/docs" style={{
            backgroundColor: '#004090', color: '#fff', padding: '12px 28px',
            borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Explore the Docs
          </Button>
          <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0 16px' }} />
          <Text style={{ fontSize: 12, color: '#a1a1aa', lineHeight: '1.5' }}>
            Angular Stream Resource — Signal-native streaming for LangGraph.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
