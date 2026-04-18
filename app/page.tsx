'use client'
import { useRef, useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const LANGUAGES = ['English','Korean','Japanese','Spanish','French','Chinese','Arabic','Hindi','Tamil','German','Italian','Portuguese','Russian','Turkish']

interface Popup {
  el: HTMLElement
  text: string
  x: number
  y: number
}

export default function Home() {
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [status, setStatus] = useState('Ready - upload a document or image')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('English')
  const [popup, setPopup] = useState<Popup | null>(null)
  const [popupText, setPopupText] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const currentPlaceholder = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!pages.length || !previewRef.current) return
    const placeholders = previewRef.current.querySelectorAll('[data-placeholder]')
    placeholders.forEach((el) => {
      const div = el as HTMLDivElement
      div.style.cursor = 'pointer'
      div.onclick = () => { currentPlaceholder.current = div; imgInputRef.current?.click() }
    })
    const rotated = previewRef.current.querySelectorAll('[data-rotated]')
    rotated.forEach((el) => {
      const div = el as HTMLDivElement
      div.onclick = (e) => {
        e.stopPropagation()
        const rect = div.getBoundingClientRect()
        setPopup({ el: div, text: div.getAttribute('data-text') || '', x: rect.left, y: rect.bottom + 8 })
        setPopupText(div.getAttribute('data-text') || '')
      }
    })
  }, [pages, currentPage])

  function applyPopup() {
    if (!popup) return
    popup.el.setAttribute('data-text', popupText)
    popup.el.setAttribute('title', popupText)
    setPopup(null)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentPlaceholder.current) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      if (!currentPlaceholder.current) return
      currentPlaceholder.current.style.backgroundImage = 'url(' + url + ')'
      currentPlaceholder.current.style.backgroundSize = 'cover'
      currentPlaceholder.current.style.backgroundPosition = 'center'
      currentPlaceholder.current.style.border = 'none'
      currentPlaceholder.current.innerHTML = ''
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setIsError(false)
    setStatus('Analyzing document...')
    setPages([])
    setCurrentPage(0)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/reconstruct', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPages(data.pages)
      setStatus('Done - click any text to edit')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('Error: ' + message)
      setIsError(true)
    }
    setLoading(false)
    e.target.value = ''
  }

  async function handleTranslate() {
    if (!pages.length) return
    setLoading(true)
    setIsError(false)
    setStatus('Translating to ' + language + '...')
    try {
      const translatedPages: string[] = []
      for (let i = 0; i < pages.length; i++) {
        setStatus('Translating page ' + (i+1) + ' of ' + pages.length + '...')
        const parser = new DOMParser()
        const doc = parser.parseFromString(pages[i], 'text/html')
        const fields = doc.querySelectorAll('[data-field]')
        const rotated = doc.querySelectorAll('[data-rotated]')
        const texts = [...Array.from(fields).map(s => s.textContent || ''), ...Array.from(rotated).map(s => s.getAttribute('data-text') || '')]
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts, targetLanguage: language }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        fields.forEach((span, j) => { if (data.translated[j] !== undefined) span.textContent = data.translated[j] })
        rotated.forEach((el, j) => { const idx = fields.length + j; if (data.translated[idx] !== undefined) { el.setAttribute('data-text', data.translated[idx]); el.setAttribute('title', data.translated[idx]) } })
        translatedPages.push(doc.body.innerHTML)
      }
      setPages(translatedPages)
      setStatus('Translated to ' + language + ' successfully')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('Translation error: ' + message)
      setIsError(true)
    }
    setLoading(false)
  }

  async function handleDownloadPDF() {
    if (!previewRef.current) return
    setLoading(true)
    setStatus('Generating PDF...')
    try {
      const pdf = new jsPDF({ unit: 'px', format: 'a4', hotfixes: ['px_scaling'] })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      for (let i = 0; i < pages.length; i++) {
        setCurrentPage(i)
        await new Promise(r => setTimeout(r, 300))
        const canvas = await html2canvas(previewRef.current!, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, 0, pw, ph)
      }
      pdf.save('texbee-document.pdf')
      setStatus('PDF downloaded!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('Download error: ' + message)
      setIsError(true)
    }
    setLoading(false)
  }

  async function handleDownloadWord() {
    if (!previewRef.current) return
    setLoading(true)
    setStatus('Generating Word document...')
    try {
      const canvas = await html2canvas(previewRef.current!, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const imgData = canvas.toDataURL('image/png', 1.0)
      const base64 = imgData.split(',')[1]
      const wordHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;"><img src="data:image/png;base64,' + base64 + '" style="width:100%;" /></body></html>'
      const blob = new Blob([wordHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'texbee-document.doc'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('Word document downloaded!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('Download error: ' + message)
      setIsError(true)
    }
    setLoading(false)
  }

  const taupe = '#4a3728'
  const taupeLight = '#6b5242'
  const taupeAccent = '#c4a882'
  const cream = '#f5f0eb'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: taupe }} onClick={() => setPopup(null)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: taupe, borderBottom: '1px solid ' + taupeLight, flexWrap: 'wrap' }}>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: taupeAccent, fontFamily: 'Georgia, serif', letterSpacing: '0.05em' }}>TexBee</span>
          <span style={{ fontSize: 12, color: '#9e8a7a', fontStyle: 'italic' }}>Document Translation</span>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={loading} style={{ padding: '8px 18px', fontSize: 13, border: '1px solid ' + taupeAccent, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: taupeAccent }}>
          {loading ? 'Processing...' : 'Upload'}
        </button>
        <select value={language} onChange={e => setLanguage(e.target.value)} disabled={!pages.length || loading} style={{ padding: '8px 12px', fontSize: 13, border: '1px solid ' + taupeAccent, borderRadius: 6, background: taupeLight, color: cream }}>
          {LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
        <button onClick={handleTranslate} disabled={!pages.length || loading} style={{ padding: '8px 18px', fontSize: 13, border: '1px solid ' + taupeAccent, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: taupeAccent }}>
          Translate
        </button>
        <button onClick={handleDownloadPDF} disabled={!pages.length || loading} style={{ padding: '8px 18px', fontSize: 13, border: 'none', borderRadius: 6, cursor: 'pointer', background: taupeAccent, color: taupe, fontWeight: 600 }}>
          PDF
        </button>
        <button onClick={handleDownloadWord} disabled={!pages.length || loading} style={{ padding: '8px 18px', fontSize: 13, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#8b7355', color: cream, fontWeight: 600 }}>
          Word
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'flex-start', position: 'relative' }}>
        {pages.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {pages.map((_, i) => (
              <div key={i} onClick={() => setCurrentPage(i)} style={{ width: 48, height: 64, background: currentPage === i ? taupeAccent : taupeLight, color: currentPage === i ? taupe : cream, border: '1px solid ' + taupeAccent, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {i + 1}
              </div>
            ))}
          </div>
        )}
        {!pages.length && !loading && (
          <div onClick={() => fileInputRef.current?.click()} style={{ width: 794, minHeight: 500, background: taupeLight, borderRadius: 8, border: '2px dashed ' + taupeAccent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 16, color: taupeAccent }}>
            <span style={{ fontSize: 56 }}>📄</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>Upload a Document</span>
            <span style={{ fontSize: 13, color: '#9e8a7a' }}>PDF, JPG, or PNG</span>
          </div>
        )}
        {loading && !pages.length && (
          <div style={{ width: 794, minHeight: 500, background: taupeLight, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: taupeAccent }}>
            <span>Analyzing your document...</span>
          </div>
        )}
        {pages.length > 0 && (
          <div ref={previewRef} style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', borderRadius: 4 }} dangerouslySetInnerHTML={{ __html: pages[currentPage] }} />
        )}
        {popup && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: Math.min(popup.x, window.innerWidth - 320), top: popup.y, zIndex: 9999, background: cream, border: '1px solid ' + taupeAccent, borderRadius: 8, padding: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', width: 300 }}>
            <div style={{ fontSize: 12, color: taupeLight, marginBottom: 8 }}>Edit rotated text:</div>
            <input autoFocus value={popupText} onChange={e => setPopupText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyPopup(); if (e.key === 'Escape') setPopup(null) }} style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid ' + taupeAccent, borderRadius: 6, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={applyPopup} style={{ flex: 1, padding: '7px', fontSize: 13, background: taupe, color: cream, border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apply</button>
              <button onClick={() => setPopup(null)} style={{ flex: 1, padding: '7px', fontSize: 13, background: 'white', border: '1px solid ' + taupeAccent, borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 20px', fontSize: 12, color: isError ? '#ff8a80' : taupeAccent, borderTop: '1px solid ' + taupeLight, background: taupe }}>
        {status}
      </div>
      <input ref={fileInputRef} type='file' accept='.pdf,.jpg,.jpeg,.png' onChange={handleUpload} style={{ display: 'none' }} />
      <input ref={imgInputRef} type='file' accept='image/*' onChange={handleImageUpload} style={{ display: 'none' }} />
    </div>
  )
}