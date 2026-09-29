'use client'

import { track } from '@vercel/analytics'
import { useEffect, useMemo, useRef, useState } from 'react'

import './wiki-completion-certificate.css'

type CertificateProps = {
  title: string
  quizLabel: string
  streak: number
  readCount: number
  totalCount: number
  percent: number
  achievementCount: number
  treasureCount: number
  treasureTotal: number
}

function certificateId() {
  const key = 'justserver3-certificate-id'
  const saved = window.localStorage.getItem(key)
  if (/^JUST-A\d{4}$/.test(saved || '')) return saved as string

  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)
  const number = (values[0] % 10000).toString().padStart(4, '0')
  const next = `JUST-A${number}`
  window.localStorage.setItem(key, next)
  return next
}

function loadCertificateLogo() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = '/survival-certificate-logo.webp'
  })
}

async function drawCertificate(canvas: HTMLCanvasElement, props: CertificateProps, id: string, issuedAt: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = 1200, height = 675
  canvas.width = width; canvas.height = height
  const complete = props.totalCount > 0 && props.readCount >= props.totalCount

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#070505'); bg.addColorStop(.48, '#1b0908'); bg.addColorStop(1, '#080606')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(220, 300, 10, 220, 300, 340)
  glow.addColorStop(0, complete ? 'rgba(215,63,28,.44)' : 'rgba(157,29,20,.38)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 520, height)

  ctx.strokeStyle = complete ? '#d9aa50' : '#9b6037'; ctx.lineWidth = 4; ctx.strokeRect(22, 22, 1156, 631)
  ctx.strokeStyle = '#5d211a'; ctx.lineWidth = 2; ctx.strokeRect(34, 34, 1132, 607)

  try {
    const logo = await loadCertificateLogo()
    ctx.drawImage(logo, 86, 105, 288, 288)
  } catch {
    ctx.fillStyle = '#7d1712'; ctx.beginPath(); ctx.arc(230, 245, 120, 0, Math.PI * 2); ctx.fill()
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0d4a7'; ctx.font = '900 39px system-ui, sans-serif'; ctx.fillText('그냥서버 적자생존', 230, 452)
  ctx.fillStyle = '#aa7149'; ctx.font = '700 18px system-ui, sans-serif'; ctx.fillText('SURVIVAL WIKI', 230, 486)

  const x = 445, w = 710
  ctx.textAlign = 'left'
  ctx.fillStyle = '#100b0a'; ctx.strokeStyle = complete ? '#d2a04a' : '#8d5533'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.roundRect(x, 65, w, 120, 18); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#f5e5cc'; ctx.font = '900 47px system-ui, sans-serif'
  ctx.fillText(complete ? '위키 완전정복 인증서' : '위키 완독 인증서', x + 34, 130)
  ctx.fillStyle = '#a97850'; ctx.font = '700 16px system-ui, sans-serif'; ctx.fillText('WIKI COMPLETION CERTIFICATE', x + 36, 160)

  ctx.fillStyle = '#0e0b0a'; ctx.strokeStyle = '#633127'
  ctx.beginPath(); ctx.roundRect(x, 207, w, 174, 18); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#c89a69'; ctx.font = '800 21px system-ui, sans-serif'; ctx.fillText('위키 탐험도', x + 32, 252)
  ctx.fillStyle = '#fff1dc'; ctx.font = '900 76px system-ui, sans-serif'; ctx.fillText(`${props.percent}%`, x + 30, 332)
  ctx.fillStyle = '#f1ddc1'; ctx.font = '800 30px system-ui, sans-serif'; ctx.fillText(`${props.readCount} / ${props.totalCount}`, x + 515, 296)
  ctx.fillStyle = '#a99078'; ctx.font = '700 17px system-ui, sans-serif'; ctx.fillText('문서 완독', x + 530, 326)
  ctx.fillStyle = '#241714'; ctx.beginPath(); ctx.roundRect(x + 30, 348, w - 60, 13, 7); ctx.fill()
  const bw = (w - 60) * Math.min(100, props.percent) / 100
  const bar = ctx.createLinearGradient(x + 30, 0, x + w - 30, 0); bar.addColorStop(0, '#821b16'); bar.addColorStop(1, complete ? '#e0ad55' : '#e34a2f')
  ctx.fillStyle = bar; ctx.beginPath(); ctx.roundRect(x + 30, 348, bw, 13, 7); ctx.fill()

  const metrics = [['연속 생존일', `${props.streak}일`], ['업적 달성', `${props.achievementCount}/9`], ['위키 보물', `${props.treasureCount}/${props.treasureTotal}`], ['생존형', props.quizLabel]]
  metrics.forEach(([label, value], i) => {
    const mx = x + i * 177.5
    ctx.fillStyle = '#100c0b'; ctx.strokeStyle = '#5e3025'; ctx.beginPath(); ctx.roundRect(mx, 401, 164, 111, 14); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#a98466'; ctx.font = '700 15px system-ui, sans-serif'; ctx.fillText(label, mx + 15, 432)
    ctx.fillStyle = '#f4e3ca'; ctx.font = value.length > 9 ? '800 18px system-ui, sans-serif' : '900 27px system-ui, sans-serif'; ctx.fillText(value, mx + 15, 477)
  })

  ctx.fillStyle = '#160908'; ctx.strokeStyle = complete ? '#d0a04b' : '#79392c'
  ctx.beginPath(); ctx.roundRect(x, 535, 405, 86, 14); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#b78b68'; ctx.font = '700 15px system-ui, sans-serif'; ctx.fillText('인증번호', x + 22, 563)
  ctx.fillStyle = '#f6dfbd'; ctx.font = '900 32px ui-monospace, monospace'; ctx.fillText(id, x + 22, 601)

  ctx.fillStyle = '#0f0c0b'; ctx.strokeStyle = '#573029'; ctx.beginPath(); ctx.roundRect(x + 425, 535, 285, 86, 14); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#a98466'; ctx.font = '700 15px system-ui, sans-serif'; ctx.fillText('발급일', x + 445, 563)
  ctx.fillStyle = '#ead9c4'; ctx.font = '800 22px system-ui, sans-serif'; ctx.fillText(issuedAt, x + 445, 598)
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/png')
  })
}

export function WikiCompletionCertificate(props: CertificateProps) {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState('JUST-A0000')
  const [status, setStatus] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const complete = props.totalCount > 0 && props.readCount >= props.totalCount
  const issuedAt = useMemo(
    () => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    []
  )

  useEffect(() => setId(certificateId()), [])

  useEffect(() => {
    if (open && canvasRef.current) void drawCertificate(canvasRef.current, props, id, issuedAt)
  }, [id, issuedAt, open, props])

  const getFile = async () => {
    if (!canvasRef.current) throw new Error('canvas')
    const blob = await canvasBlob(canvasRef.current)
    return new File([blob], `${id}.png`, { type: 'image/png' })
  }

  const download = async () => {
    try {
      const file = await getFile()
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('인증 이미지를 저장했습니다.')
      track('wiki_completion_certificate_download', { complete: complete ? 'yes' : 'no' })
    } catch {
      setStatus('이미지 저장에 실패했습니다.')
    }
  }

  const copy = async () => {
    try {
      if (!canvasRef.current) throw new Error('canvas')
      const blob = await canvasBlob(canvasRef.current)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus('이미지를 복사했습니다. Discord나 SOOP 게시글에 붙여넣어 보세요.')
      track('wiki_completion_certificate_copy', { complete: complete ? 'yes' : 'no' })
    } catch {
      setStatus('이 브라우저는 이미지 복사를 지원하지 않습니다. 이미지 저장을 이용해 주세요.')
    }
  }

  const share = async () => {
    try {
      const file = await getFile()
      const shareData = {
        title: complete ? '그냥서버 위키 완전정복 인증' : '그냥서버 위키 완독 인증',
        text: `위키 탐험도 ${props.percent}% · ${props.readCount}/${props.totalCount} 완독 · ${id}`,
        files: [file]
      }
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData)
        track('wiki_completion_certificate_share', { complete: complete ? 'yes' : 'no' })
      } else {
        await copy()
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setStatus('공유하지 못했습니다. 이미지 복사 또는 저장을 이용해 주세요.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="completion-certificate-open"
        onClick={() => {
          setOpen(true)
          setStatus('')
          track('wiki_completion_certificate_open')
        }}
      >
        위키 완독 인증
      </button>

      {open && (
        <div className="completion-certificate-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setOpen(false)}>
          <section className="completion-certificate-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-certificate-title">
            <header>
              <div>
                <small>WIKI COMPLETION CERTIFICATE</small>
                <h3 id="completion-certificate-title">{complete ? '위키 완전정복 인증' : '위키 완독 인증'}</h3>
                <p>실제로 완독 처리된 준비 가이드 기록으로 인증 이미지를 만듭니다.</p>
              </div>
              <button type="button" className="completion-certificate-close" aria-label="닫기" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className={`completion-certificate-preview ${complete ? 'is-complete' : ''}`}>
              <canvas ref={canvasRef} aria-label="그냥서버 위키 완독 인증 이미지 미리보기" />
            </div>

            <div className="completion-certificate-summary">
              <strong>{props.percent}% · {props.readCount}/{props.totalCount} 완독</strong>
              <span>{id}</span>
            </div>

            <div className="completion-certificate-actions">
              <button type="button" onClick={() => void copy()}>이미지 복사</button>
              <button type="button" onClick={() => void download()}>이미지 저장</button>
              <button type="button" className="is-primary" onClick={() => void share()}>공유하기</button>
            </div>
            <p className="completion-certificate-help">Discord에는 이미지 복사 후 붙여넣기, SOOP 방송국에는 저장한 이미지를 첨부하는 방식이 가장 안정적입니다.</p>
            {status && <p className="completion-certificate-status" role="status">{status}</p>}
          </section>
        </div>
      )}
    </>
  )
}
