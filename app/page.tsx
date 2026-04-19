'use client'
import { useRef, useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun } from 'docx'

const LANGUAGES = ['English','Korean','Japanese','Spanish','French','Chinese','Arabic','Hindi','Tamil','German','Italian','Portuguese','Russian','Turkish']

export default function Home() {
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('English')
  const [scrolled, setScrolled] = useState(false)
  const [renderKey, setRenderKey] = useState(0)
  const [popup, setPopup] = useState<{el:HTMLElement,text:string,x:number,y:number}|null>(null)
  const [popupText, setPopupText] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (!pages.length || !previewRef.current) return
    previewRef.current.querySelectorAll('[data-rotated]').forEach((el) => {
      const div = el as HTMLDivElement
      div.onclick = (e) => {
        e.stopPropagation()
        const rect = div.getBoundingClientRect()
        setPopup({ el: div, text: div.getAttribute('data-text') || '', x: rect.left, y: rect.bottom + 8 })
        setPopupText(div.getAttribute('data-text') || '')
      }
    })
  }, [pages, currentPage, renderKey])

  function applyPopup() {
    if (!popup) return
    popup.el.setAttribute('data-text', popupText)
    setPopup(null)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setIsError(false); setStatus('Analyzing...'); setPages([]); setCurrentPage(0)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/reconstruct', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPages(data.pages); setStatus('Done')
    } catch (err: unknown) {
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown')); setIsError(true)
    }
    setLoading(false); e.target.value = ''
  }

  async function handleTranslate() {
    if (!pages.length) return
    setLoading(true); setIsError(false); setStatus('Translating...')
    try {
      const translatedPages: string[] = []
      for (let i = 0; i < pages.length; i++) {
        setStatus('Translating page ' + (i+1) + '...')
        const parser = new DOMParser()
        const doc = parser.parseFromString(pages[i], 'text/html')
        const fields = doc.querySelectorAll('[data-field]')
        const rotated = doc.querySelectorAll('[data-rotated]')
        const texts = [...Array.from(fields).map(s => s.textContent || ''), ...Array.from(rotated).map(s => s.getAttribute('data-text') || '')]
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts, targetLanguage: language }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        fields.forEach((span, j) => { if (data.translated[j] !== undefined) span.textContent = data.translated[j] })
        rotated.forEach((el, j) => { const idx = fields.length + j; if (data.translated[idx] !== undefined) el.setAttribute('data-text', data.translated[idx]) })
        translatedPages.push(doc.body.firstElementChild ? doc.body.firstElementChild.outerHTML : doc.body.innerHTML)
      }
      setPages([...translatedPages]); setRenderKey(k => k+1); setStatus('Translated to ' + language)
    } catch (err: unknown) {
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown')); setIsError(true)
    }
    setLoading(false)
  }

  async function handleDownloadPDF() {
    if (!previewRef.current) return
    setLoading(true); setStatus('Generating PDF...')
    try {
      const pdf = new jsPDF({ unit: 'px', format: 'a4', hotfixes: ['px_scaling'] })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      for (let i = 0; i < pages.length; i++) {
        setCurrentPage(i); await new Promise(r => setTimeout(r, 400))
        const canvas = await html2canvas(previewRef.current!, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
        if (i > 0) pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, ph)
      }
      pdf.save('texbee-document.pdf'); setStatus('PDF downloaded!')
    } catch (err: unknown) {
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown')); setIsError(true)
    }
    setLoading(false)
  }

  async function handleDownloadWord() {
    if (!previewRef.current) return
    setLoading(true); setStatus('Generating Word...')
    try {
      const fields = previewRef.current.querySelectorAll('[data-field]')
      const children: any[] = []
      fields.forEach((el) => {
        const div = el as HTMLDivElement
        const text = div.textContent?.trim() || ''
        if (!text) return
        const fontSize = Math.max(8, parseInt(div.style.fontSize) || 12)
        const bold = div.style.fontWeight === 'bold'
        children.push(new Paragraph({ children: [new TextRun({ text, bold, size: Math.round(fontSize * 1.5) })] }))
      })
      if (!children.length) children.push(new Paragraph({ children: [new TextRun({ text: 'No text found' })] }))
      const doc = new Document({ sections: [{ children }] })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'texbee-document.docx'; a.click()
      URL.revokeObjectURL(url); setStatus('Word downloaded!')
    } catch (err: unknown) {
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown')); setIsError(true)
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#f8f6f3 0%,#ede8e0 100%)',fontFamily:'system-ui,sans-serif'}} onClick={() => setPopup(null)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:100px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s ease;border:none;outline:none;font-family:'Inter',sans-serif}
        .btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.15)}
        .btn:active{transform:translateY(0)}
        .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none}
        .btn-outline{background:transparent;border:1.5px solid rgba(74,55,40,0.25);color:#4a3728}
        .btn-outline:hover{background:rgba(74,55,40,0.05);border-color:#4a3728}
        .btn-primary{background:#4a3728;color:white}
        .btn-primary:hover{background:#5c4535}
        .btn-accent{background:linear-gradient(135deg,#c4a882,#a68b65);color:white}
        .btn-accent:hover{filter:brightness(1.1)}
        .btn-blue{background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white}
        .btn-blue:hover{filter:brightness(1.1)}
        .upload-zone{border:2px dashed rgba(74,55,40,0.2);border-radius:16px;transition:all 0.3s ease;cursor:pointer;background:white}
        .upload-zone:hover{border-color:#c4a882;background:rgba(196,168,130,0.04);transform:scale(1.01)}
        .page-thumb{cursor:pointer;border-radius:8px;transition:all 0.2s}
        .page-thumb:hover{transform:scale(1.05)}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.4s ease}
        .spin{animation:spin 0.8s linear infinite}
        @media(max-width:768px){
          .hide-mobile{display:none!important}
          .header-inner{padding:12px 16px!important}
          .main-pad{padding:100px 16px 32px!important}
          .hero-title{font-size:32px!important}
        }
      `}</style>

      <header style={{position:'fixed',top:0,left:0,right:0,zIndex:100,transition:'all 0.3s ease',background:scrolled?'rgba(255,255,255,0.92)':'transparent',backdropFilter:scrolled?'blur(12px)':'none',boxShadow:scrolled?'0 1px 20px rgba(0,0,0,0.08)':'none'}}>
        <div className="header-inner" style={{display:'flex',alignItems:'center',gap:10,padding:'16px 32px',flexWrap:'wrap'}}>
          <div style={{marginRight:'auto',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,background:'linear-gradient(135deg,#4a3728,#8b6f47)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🐝</div>
            <div>
              <div style={{fontSize:20,fontWeight:700,fontFamily:'Playfair Display,serif',color:'#2c1a0e',lineHeight:1}}>TexBee</div>
              <div style={{fontSize:10,color:'#8b6f47',letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:'Inter,sans-serif'}}>Document Translation</div>
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? <div style={{width:14,height:14,border:'2px solid rgba(74,55,40,0.3)',borderTopColor:'#4a3728',borderRadius:'50%'}} className="spin"/> : '↑'}
            <span className="hide-mobile">{loading ? 'Processing...' : 'Upload'}</span>
          </button>
          <select value={language} onChange={e => setLanguage(e.target.value)} disabled={!pages.length||loading} style={{padding:'9px 14px',fontSize:13,border:'1.5px solid rgba(74,55,40,0.2)',borderRadius:100,background:'white',color:'#4a3728',fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>
          <button className="btn btn-outline" onClick={handleTranslate} disabled={!pages.length||loading}>
            🌐 <span className="hide-mobile">Translate</span>
          </button>
          <button className="btn btn-accent" onClick={handleDownloadPDF} disabled={!pages.length||loading}>
            ↓ <span className="hide-mobile">PDF</span>
          </button>
          <button className="btn btn-blue" onClick={handleDownloadWord} disabled={!pages.length||loading}>
            ↓ <span className="hide-mobile">Word</span>
          </button>
        </div>
        {status && (
          <div style={{background:isError?'#fee2e2':'#f0fdf4',borderTop:'1px solid '+(isError?'#fecaca':'#bbf7d0'),padding:'5px 32px',fontSize:12,color:isError?'#dc2626':'#16a34a',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:6}}>
            {loading && <div style={{width:10,height:10,border:'1.5px solid rgba(22,163,74,0.3)',borderTopColor:'#16a34a',borderRadius:'50%'}} className="spin"/>}
            {status}
          </div>
        )}
      </header>

      <main className="main-pad" style={{padding:'110px 32px 48px',maxWidth:1100,margin:'0 auto'}}>
        {!pages.length && !loading && (
          <div className="fade-in" style={{textAlign:'center',paddingTop:60}}>
            <h1 className="hero-title" style={{fontSize:52,fontFamily:'Playfair Display,serif',color:'#2c1a0e',marginBottom:16,lineHeight:1.15}}>
              Translate Documents<br/><span style={{color:'#c4a882'}}>Beautifully</span>
            </h1>
            <p style={{fontSize:16,color:'#8b6f47',marginBottom:48,fontFamily:'Inter,sans-serif'}}>Upload any PDF or image. Edit, translate, and download.</p>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()} style={{maxWidth:480,margin:'0 auto',padding:'56px 40px',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
              <div style={{width:68,height:68,background:'linear-gradient(135deg,#f5efe8,#ede0ce)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>📄</div>
              <div style={{fontSize:18,fontWeight:600,color:'#2c1a0e',fontFamily:'Inter,sans-serif'}}>Drop your document here</div>
              <div style={{fontSize:13,color:'#a08060',fontFamily:'Inter,sans-serif'}}>PDF, JPG, or PNG supported</div>
              <button className="btn btn-primary" style={{marginTop:4}}>Choose File</button>
            </div>
          </div>
        )}

        {loading && !pages.length && (
          <div className="fade-in" style={{textAlign:'center',paddingTop:120}}>
            <div style={{width:56,height:56,border:'3px solid #ede0ce',borderTopColor:'#c4a882',borderRadius:'50%',margin:'0 auto 24px'}} className="spin"/>
            <p style={{fontSize:15,color:'#8b6f47',fontFamily:'Inter,sans-serif'}}>{status}</p>
          </div>
        )}

        {pages.length > 0 && (
          <div className="fade-in" style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
            {pages.length > 1 && (
              <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
                {pages.map((_, i) => (
                  <div key={i} className="page-thumb" onClick={() => setCurrentPage(i)} style={{width:48,height:64,background:currentPage===i?'#4a3728':'white',color:currentPage===i?'white':'#4a3728',border:'1.5px solid '+(currentPage===i?'#4a3728':'rgba(74,55,40,0.2)'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,boxShadow:currentPage===i?'0 4px 12px rgba(74,55,40,0.25)':'none'}}>
                    {i+1}
                  </div>
                ))}
              </div>
            )}
            <div style={{flex:1,minWidth:0,overflowX:'auto'}}>
              <div key={renderKey+'-'+currentPage} ref={previewRef} style={{background:'white',boxShadow:'0 8px 40px rgba(0,0,0,0.12)',borderRadius:8,overflow:'hidden',display:'inline-block'}} dangerouslySetInnerHTML={{__html:pages[currentPage]}}/>
            </div>
          </div>
        )}
      </main>

      {popup && (
        <div onClick={e => e.stopPropagation()} style={{position:'fixed',left:Math.min(popup.x,window.innerWidth-320),top:popup.y,zIndex:9999,background:'white',border:'1px solid rgba(196,168,130,0.4)',borderRadius:12,padding:16,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',width:300}}>
          <div style={{fontSize:12,color:'#8b6f47',marginBottom:8,fontFamily:'Inter,sans-serif',fontWeight:500}}>Edit rotated text</div>
          <input autoFocus value={popupText} onChange={e => setPopupText(e.target.value)} onKeyDown={e => {if(e.key==='Enter')applyPopup();if(e.key==='Escape')setPopup(null)}} style={{width:'100%',padding:'8px 12px',fontSize:14,border:'1.5px solid rgba(196,168,130,0.4)',borderRadius:8,outline:'none',fontFamily:'Inter,sans-serif'}}/>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button onClick={applyPopup} className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>Apply</button>
            <button onClick={() => setPopup(null)} className="btn btn-outline" style={{flex:1,justifyContent:'center'}}>Cancel</button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type='file' accept='.pdf,.jpg,.jpeg,.png' onChange={handleUpload} style={{display:'none'}}/>
    </div>
  )
}
