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

function drawCertificate(
  canvas: HTMLCanvasElement,
  props: CertificateProps,
  id: string,
  issuedAt: string
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = 1200
  const height = 675
  canvas.width = width
  canvas.height = height

  const complete = props.totalCount > 0 && props.readCount >= props.totalCount
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, complete ? '#171b16' : '#15191d')
  gradient.addColorStop(1, complete ? '#29301d' : '#202a31')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = complete ? '#d9c96d' : '#768c99'
  ctx.lineWidth = 3
  ctx.strokeRect(32, 32, width - 64, height - 64)
  ctx.strokeStyle = 'rgba(255,255,255,.10)'
  ctx.lineWidth = 1
  ctx.strokeRect(46, 46, width - 92, height - 92)

  ctx.fillStyle = complete ? '#d9c96d' : '#9eb2bd'
  ctx.font = '600 24px system-ui, sans-serif'
  ctx.fillText('JUST SERVER · OFFICIAL WIKI', 82, 102)

  ctx.fillStyle = '#f4f6f7'
  ctx.font = '800 52px system-ui, sans-serif'
  ctx.fillText(complete ? '위키 완전정복 인증' : '위키 완독 인증', 82, 172)

  ctx.fillStyle = '#aeb9bf'
  ctx.font = '500 22px system-ui, sans-serif'
  ctx.fillText('그냥서버 : 적자생존', 82, 210)

  ctx.fillStyle = '#ffffff'
  ctx.font = '900 88px system-ui, sans-serif'
  ctx.fillText(`${props.percent}%`, 82, 330)
  ctx.fillStyle = '#c9d2d7'
  ctx.font = '700 27px system-ui, sans-serif'
  ctx.fillText(`${props.readCount} / ${props.totalCount} 준비된 가이드 완독`, 82, 374)

  const metrics = [
    ['대표 칭호', props.title],
    ['연속 생존', `${props.streak}일`],
    ['업적', `${props.achievementCount}/9`],
    ['위키 보물', `${props.treasureCount}/${props.treasureTotal}`]
  ]
  metrics.forEach(([label, value], index) => {
    const x = 82 + index * 255
    ctx.fillStyle = '#8e9ba3'
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.fillText(label, x, 466)
    ctx.fillStyle = '#f4f6f7'
    ctx.font = '800 25px system-ui, sans-serif'
    ctx.fillText(value, x, 501)
  })

  ctx.fillStyle = '#87949b'
  ctx.font = '500 18px system-ui, sans-serif'
  ctx.fillText(`생존형 · ${props.quizLabel}`, 82, 558)
  ctx.fillText(`발급일 · ${issuedAt}`, 82, 591)

  ctx.textAlign = 'right'
  ctx.fillStyle = complete ? '#d9c96d' : '#b7c6ce'
  ctx.font = '800 28px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(id, 1118, 570)
  ctx.fillStyle = '#75838b'
  ctx.font = '500 15px system-ui, sans-serif'
  ctx.fillText('이 번호는 이 브라우저의 공유 카드 식별번호입니다.', 1118, 596)
  ctx.textAlign = 'left'
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
    if (open && canvasRef.current) drawCertificate(canvasRef.current, props, id, issuedAt)
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
