import {
  Html, Head, Body, Container, Section, Text, Button, Hr,
} from '@react-email/components';

interface WhitepaperDownloadProps {
  name?: string;
}

const DOWNLOAD_URL = 'https://stream-resource.dev/whitepaper.pdf';

export default function WhitepaperDownload({ name }: WhitepaperDownloadProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f4f4f5', padding: '40px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', backgroundColor: '#fff', borderRadius: 12, padding: '32px 40px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#004090', fontWeight: 700 }}>
            Angular Stream Resource
          </Text>
          <Text style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '12px 0 8px' }}>
            Your Angular Agent Readiness Guide
          </Text>
          <Text style={{ fontSize: 14, color: '#3f3f46', lineHeight: '1.6', margin: '0 0 24px' }}>
            {name ? `Hi ${name}, t` : 'T'}he guide covers six production-readiness dimensions: streaming state, thread persistence,
            tool-call rendering, human approval flows, generative UI, and deterministic testing.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
            <Button href={DOWNLOAD_URL} style={{
              backgroundColor: '#004090', color: '#fff', padding: '14px 32px',
              borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}>
              Download the Guide
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
          <Text style={{ fontSize: 12, color: '#a1a1aa', lineHeight: '1.5' }}>
            Angular Stream Resource — Signal-native streaming for LangGraph.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
