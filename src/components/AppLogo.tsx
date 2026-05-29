import Image from 'next/image'

export default function AppLogo({ height = 24 }: { height?: number }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '6px',
      padding: '3px 8px',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <Image
        src="/reframe-logo.png"
        alt="Reframe Concepts"
        height={height}
        width={height * 4}
        style={{ height: `${height}px`, width: 'auto', display: 'block' }}
      />
    </div>
  )
}
