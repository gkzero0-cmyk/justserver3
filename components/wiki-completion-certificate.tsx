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
  const width = 1200, height = 675, scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const complete = props.totalCount > 0 && props.readCount >= props.totalCount

  const panel = (x: number, y: number, w: number, h: number, radius = 14, strong = false) => {
    ctx.fillStyle = strong ? 'rgba(24,8,6,.94)' : 'rgba(12,8,7,.9)'
    ctx.strokeStyle = strong ? (complete ? '#d8a84d' : '#9f4b2d') : '#7b3829'
    ctx.lineWidth = strong ? 1.8 : 1.25
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); ctx.stroke()
  }
  const icon = (kind: string, x: number, y: number) => {
    ctx.save(); ctx.strokeStyle = '#c56e43'; ctx.fillStyle = '#c56e43'; ctx.lineWidth = 2
    if (kind === 'calendar') { ctx.strokeRect(x, y + 3, 20, 17); ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 20, y + 8); ctx.stroke() }
    if (kind === 'award') { ctx.strokeRect(x + 3, y + 1, 14, 18); ctx.beginPath(); ctx.moveTo(x + 7, y + 6); ctx.lineTo(x + 14, y + 6); ctx.moveTo(x + 7, y + 10); ctx.lineTo(x + 14, y + 10); ctx.stroke() }
    if (kind === 'treasure') { ctx.strokeRect(x, y + 8, 21, 12); ctx.beginPath(); ctx.arc(x + 10.5, y + 8, 10, Math.PI, 0); ctx.stroke() }
    if (kind === 'pickaxe') { ctx.beginPath(); ctx.moveTo(x + 4, y + 20); ctx.lineTo(x + 16, y + 4); ctx.moveTo(x + 8, y + 4); ctx.quadraticCurveTo(x + 16, y - 1, x + 22, y + 5); ctx.stroke() }
    ctx.restore()
  }

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#080403'); bg.addColorStop(.38, '#220907'); bg.addColorStop(1, '#090504')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height)
  const leftGlow = ctx.createRadialGradient(218, 270, 12, 218, 270, 330)
  leftGlow.addColorStop(0, complete ? 'rgba(235,56,21,.48)' : 'rgba(187,27,18,.43)')
  leftGlow.addColorStop(.52, 'rgba(106,12,9,.18)'); leftGlow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = leftGlow; ctx.fillRect(0, 0, 455, height)

  // Regal double frame with small corner accents.
  ctx.strokeStyle = complete ? '#e1b35d' : '#b46e3e'; ctx.lineWidth = 4; ctx.strokeRect(18, 18, 1164, 639)
  ctx.strokeStyle = '#7e3021'; ctx.lineWidth = 1.5; ctx.strokeRect(30, 30, 1140, 615)
  ctx.strokeStyle = '#b46e3e'; ctx.lineWidth = 2
  ;[[30,30,1,1],[1170,30,-1,1],[30,645,1,-1],[1170,645,-1,-1]].forEach(([cx,cy,sx,sy]) => {
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * 25); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * 25, cy); ctx.stroke()
  })

  // Large mascot emblem. Source is same-origin so the export canvas stays untainted.
  try {
    const logo = await loadCertificateLogo()
    ctx.save()
    ctx.shadowColor = 'rgba(235,45,24,.38)'; ctx.shadowBlur = 28
    ctx.drawImage(logo, 20, 30, 430, 430)
    ctx.restore()
  } catch {
    ctx.fillStyle = '#7d1712'; ctx.beginPath(); ctx.arc(218, 235, 142, 0, Math.PI * 2); ctx.fill()
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f4d9aa'; ctx.font = '900 34px system-ui, sans-serif'; ctx.fillText('그냥서버 적자생존', 235, 487)
  ctx.fillStyle = '#bd7d49'; ctx.font = '800 16px system-ui, sans-serif'; ctx.letterSpacing = '3px'; ctx.fillText('SURVIVAL WIKI', 235, 518)
  ctx.letterSpacing = '0px'
  ctx.strokeStyle = '#a75b35'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(88, 538); ctx.lineTo(382, 538); ctx.stroke()

  const x = 455, w = 700
  ctx.textAlign = 'left'
  panel(x, 46, w, 112, 17, true)
  ctx.fillStyle = '#f7e8cc'; ctx.font = '900 45px system-ui, sans-serif'
  ctx.fillText(complete ? '위키 완전정복 인증서' : '위키 완독 인증서', x + 34, 106)
  ctx.fillStyle = '#c38a59'; ctx.font = '800 14px system-ui, sans-serif'; ctx.letterSpacing = '2px'
  ctx.fillText('WIKI COMPLETION CERTIFICATE', x + 36, 137); ctx.letterSpacing = '0px'

  panel(x, 174, w, 183, 17, true)
  ctx.fillStyle = '#d5a66d'; ctx.font = '800 19px system-ui, sans-serif'; ctx.fillText('위키 탐험도', x + 32, 214)
  ctx.save(); ctx.shadowColor = 'rgba(231,60,30,.55)'; ctx.shadowBlur = 13
  ctx.fillStyle = '#fff0d6'; ctx.font = '900 78px system-ui, sans-serif'; ctx.fillText(`${props.percent}%`, x + 30, 294); ctx.restore()
  ctx.fillStyle = '#f1dec0'; ctx.font = '900 31px system-ui, sans-serif'; ctx.fillText(`${props.readCount} / ${props.totalCount}`, x + 545, 259)
  ctx.fillStyle = '#b9a087'; ctx.font = '700 16px system-ui, sans-serif'; ctx.fillText('문서 완독', x + 563, 289)
  ctx.fillStyle = '#2b1713'; ctx.beginPath(); ctx.roundRect(x + 30, 321, w - 60, 13, 7); ctx.fill()
  const bw = (w - 60) * Math.min(100, props.percent) / 100
  const bar = ctx.createLinearGradient(x + 30, 0, x + w - 30, 0)
  bar.addColorStop(0, '#a71814'); bar.addColorStop(.72, '#ed3c25'); bar.addColorStop(1, complete ? '#f1c56b' : '#ffb66b')
  ctx.save(); ctx.shadowColor = 'rgba(238,52,30,.65)'; ctx.shadowBlur = 9
  ctx.fillStyle = bar; ctx.beginPath(); ctx.roundRect(x + 30, 321, bw, 13, 7); ctx.fill(); ctx.restore()

  const gap = 10, metricWidth = (w - gap * 3) / 4
  const metrics = [
    ['calendar', '연속 생존일', `${props.streak}일`],
    ['award', '업적 달성', `${props.achievementCount}/9`],
    ['treasure', '위키 보물', `${props.treasureCount}/${props.treasureTotal}`],
    ['pickaxe', '생존형', props.quizLabel]
  ]
  metrics.forEach(([kind, label, value], i) => {
    const mx = x + i * (metricWidth + gap)
    panel(mx, 374, metricWidth, 108, 13)
    icon(kind, mx + 15, 391)
    ctx.fillStyle = '#c69a73'; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText(label, mx + 45, 407)
    ctx.fillStyle = '#f5e3c8'; ctx.font = value.length > 8 ? '800 17px system-ui, sans-serif' : '900 27px system-ui, sans-serif'
    ctx.fillText(value, mx + 16, 454)
  })

  const footerY = 497, footerH = 82, serialW = 420
  panel(x, footerY, serialW, footerH, 13, true)
  ctx.fillStyle = '#b98b68'; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText('인증번호', x + 24, footerY + 26)
  ctx.fillStyle = '#f6dfbd'; ctx.font = '900 29px ui-monospace, monospace'; ctx.fillText(id, x + 24, footerY + 61)
  panel(x + serialW + 12, footerY, w - serialW - 12, footerH, 13)
  ctx.fillStyle = '#b98b68'; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText('발급일', x + serialW + 34, footerY + 26)
  ctx.fillStyle = '#ead9c4'; ctx.font = '800 20px system-ui, sans-serif'; ctx.fillText(issuedAt, x + serialW + 34, footerY + 59)
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

// Compact royal certificate production release
