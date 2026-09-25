import { ImageResponse } from 'next/og'

export const alt = '그냥서버 : 적자생존 공식 위키'
export const size = {
  width: 1200,
  height: 630
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 18% 12%, rgba(198,151,79,.24), transparent 34%), radial-gradient(circle at 86% 86%, rgba(153,58,50,.24), transparent 38%), linear-gradient(135deg, #111012 0%, #171315 52%, #0c0b0c 100%)',
          color: '#f5eee8',
          padding: '72px 78px',
          fontFamily: 'sans-serif'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 28,
            border: '1px solid rgba(213,176,119,.2)',
            borderRadius: 28
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 66,
                height: 66,
                borderRadius: 18,
                border: '1px solid rgba(213,176,119,.32)',
                background: 'rgba(213,176,119,.08)',
                fontSize: 32
              }}
            >
              📖
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#d9b57c'
              }}
            >
              JUST SERVER · OFFICIAL WIKI
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 66,
                lineHeight: 1.08,
                fontWeight: 900,
                letterSpacing: '-0.035em'
              }}
            >
              그냥서버 : 적자생존
            </div>
            <div
              style={{
                display: 'flex',
                maxWidth: 900,
                fontSize: 27,
                lineHeight: 1.45,
                color: '#b9aaa3'
              }}
            >
              서버 규칙부터 돈벌이, 콘텐츠, 장비 성장까지 한곳에서 빠르게 확인하세요.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {['뉴비 필독', '콘텐츠 가이드', '성장 · 경제'].map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  padding: '10px 16px',
                  borderRadius: 999,
                  border: '1px solid rgba(213,176,119,.2)',
                  background: 'rgba(213,176,119,.05)',
                  color: '#d7c2a2',
                  fontSize: 18,
                  fontWeight: 700
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  )
}
