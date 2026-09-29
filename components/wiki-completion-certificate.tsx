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

let certificateTemplatePromise: Promise<HTMLImageElement> | null = null

function loadCertificateTemplate() {
  if (certificateTemplatePromise) return certificateTemplatePromise

  certificateTemplatePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = '/certificate-template/master.png'
  })
  return certificateTemplatePromise
}

async function drawCertificate(canvas: HTMLCanvasElement, props: CertificateProps, id: string, issuedAt: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = 1200
  const height = 675
  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const complete = props.totalCount > 0 && props.readCount >= props.totalCount
  const template = await loadCertificateTemplate()

  // The master image owns the high-resolution bear, throne, frame, panels and icons.
  // Every user-specific value is drawn below at runtime.
  ctx.drawImage(template, 0, 0, width, height)

  const textShadow = (blur = 8) => {
    ctx.shadowColor = 'rgba(0,0,0,.88)'
    ctx.shadowBlur = blur
    ctx.shadowOffsetY = 2
  }
  const clearShadow = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }
  const fitText = (
    value: string,
    x: number,
    y: number,
    maxWidth: number,
    maxSize: number,
    minSize: number,
    weight = 800,
    family = 'system-ui, sans-serif'
  ) => {
    let size = maxSize
    ctx.font = `${weight} ${size}px ${family}`
    while (size > minSize && ctx.measureText(value).width > maxWidth) {
      size -= 1
      ctx.font = `${weight} ${size}px ${family}`
    }
    ctx.fillText(value, x, y)
  }

  // Left identity plate.
  ctx.save()
  textShadow(10)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff0c8'
  fitText('그냥서버 적자생존', 256, 556, 310, 36, 28, 900)
  ctx.fillStyle = '#e9b86b'
  ctx.font = '800 17px Georgia, serif'
  ctx.fillText('S U R V I V A L   W I K I', 256, 590)
  ctx.restore()

  // Header: this changes to complete-conquest wording at 100%.
  ctx.save()
  textShadow(10)
  ctx.textAlign = 'center'
  ctx.fillStyle = complete ? '#fff4ca' : '#fff0d6'
  fitText(complete ? '위키 완전정복 인증서' : '위키 완독 인증서', 820, 127, 520, 46, 33, 900)
  ctx.fillStyle = '#e8bd78'
  ctx.font = '800 17px Georgia, serif'
  ctx.fillText('W I K I   C O M P L E T I O N   C E R T I F I C A T E', 820, 162)
  ctx.restore()

  // Exploration panel.
  ctx.save()
  ctx.textAlign = 'left'
  textShadow(8)
  ctx.fillStyle = '#f1cf91'
  ctx.font = '800 21px system-ui, sans-serif'
  ctx.fillText('위키 탐험도', 536, 241)

  ctx.save()
  ctx.shadowColor = 'rgba(255,51,29,.72)'
  ctx.shadowBlur = 18
  ctx.fillStyle = '#fff0cf'
  ctx.font = '900 72px system-ui, sans-serif'
  ctx.fillText(`${props.percent}%`, 536, 321)
  ctx.restore()

  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff2d7'
  ctx.font = '900 31px system-ui, sans-serif'
  ctx.fillText(`${props.readCount} / ${props.totalCount}`, 1084, 285)
  ctx.fillStyle = '#e1c59d'
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillText('문서 완독', 1084, 315)
  ctx.restore()

  // The generated template has a decorative example bar. Cover its inner lane so
  // the fill always represents the current user, not a baked percentage.
  const barX = 527
  const barY = 341
  const barW = 582
  const barH = 17
  ctx.save()
  clearShadow()
  ctx.fillStyle = '#160d0b'
  ctx.beginPath()
  ctx.roundRect(barX, barY, barW, barH, 9)
  ctx.fill()
  ctx.strokeStyle = '#7e452d'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const ratio = Math.max(0, Math.min(100, props.percent)) / 100
  const fillW = Math.max(0, (barW - 6) * ratio)
  if (fillW > 0) {
    const bar = ctx.createLinearGradient(barX + 3, 0, barX + barW - 3, 0)
    bar.addColorStop(0, '#b71412')
    bar.addColorStop(.68, '#ef3926')
    bar.addColorStop(1, complete ? '#ffd575' : '#ffbf75')
    ctx.shadowColor = 'rgba(255,55,31,.8)'
    ctx.shadowBlur = 10
    ctx.fillStyle = bar
    ctx.beginPath()
    ctx.roundRect(barX + 3, barY + 3, fillW, barH - 6, 6)
    ctx.fill()
  }
  ctx.restore()

  // Four runtime metric cards. Their icons and ornate frames live in the template.
  const metrics = [
    { x: 502, label: '연속 생존일', value: `${props.streak}일` },
    { x: 657, label: '업적 달성', value: `${props.achievementCount}/9` },
    { x: 812, label: '위키 보물', value: `${props.treasureCount}/${props.treasureTotal}` },
    { x: 967, label: '생존형', value: props.quizLabel }
  ]

  ctx.save()
  textShadow(7)
  for (const metric of metrics) {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e2ad6b'
    ctx.font = '700 14px system-ui, sans-serif'
    ctx.fillText(metric.label, metric.x + 57, 420)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff0d4'
    fitText(metric.value, metric.x + 75, 470, 132, 28, 17, 900)
  }
  ctx.restore()

  // Certificate serial and issue date.
  ctx.save()
  textShadow(7)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#cf9365'
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.fillText('인증번호', 583, 548)
  ctx.fillStyle = '#fff0d6'
  fitText(id, 583, 584, 250, 27, 20, 900, 'ui-monospace, monospace')

  ctx.fillStyle = '#cf9365'
  ctx.font = '700 13px system-ui, sans-serif'
  ctx.fillText('발급일', 954, 548)
  ctx.fillStyle = '#fff0d6'
  fitText(issuedAt, 954, 584, 150, 20, 15, 800)
  ctx.restore()
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
