'use client'
import { useRef, useState, useEffect } from 'react'

export default function Home() {
  const [docxBase64, setDocxBase64] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setIsError(false); setDocxBase64('')
    setFileName(file.name.replace(/\.[^.]+$/, ''))
    setStatus('Converting to Word...')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/reconstruct', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDocxBase64(data.docxBase64)
      setStatus('Your Word document is ready!')
    } catch (err: unknown) {
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown'))
      setIsError(true)
    }
    setLoading(false)
    e.target.value = ''
  }

  function handleDownload() {
    if (!docxBase64) return
    const bytes = Uint8Array.from(atob(docxBase64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (fileName || 'document') + '.docx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#f8f6f3 0%,#ede8e0 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'Inter,sans-serif',padding:'24px'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        .fade-in{animation:fadeIn 0.5s ease}
        .spin{animation:spin 0.8s linear infinite}
        .upload-zone{border:2px dashed rgba(74,55,40,0.2);border-radius:20px;transition:all 0.3s;cursor:pointer;background:white}
        .upload-zone:hover{border-color:#c4a882;background:rgba(196,168,130,0.03);transform:scale(1.01)}
        .btn-download{display:inline-flex;align-items:center;gap:10px;padding:16px 36px;background:linear-gradient(135deg,#4a3728,#6b4f3a);color:white;border:none;border-radius:100px;font-size:16px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.2s;box-shadow:0 4px 20px rgba(74,55,40,0.3)}
        .btn-download:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(74,55,40,0.4)}
        .btn-download:active{transform:translateY(0)}
        .btn-upload-again{display:inline-flex;align-items:center;gap:6px;padding:10px 22px;background:transparent;color:#8b6f47;border:1.5px solid rgba(74,55,40,0.2);border-radius:100px;font-size:13px;font-weight:500;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.2s;margin-top:14px}
        .btn-upload-again:hover{background:rgba(74,55,40,0.05);border-color:#8b6f47}
      `}</style>

      {/* Logo */}
      <div style={{position:'fixed',top:0,left:0,right:0,padding:'18px 32px',display:'flex',alignItems:'center',gap:10,background:scrolled?'rgba(255,255,255,0.92)':'transparent',backdropFilter:scrolled?'blur(12px)':'none',transition:'all 0.3s',boxShadow:scrolled?'0 1px 16px rgba(0,0,0,0.07)':'none'}}>
        <div style={{width:32,height:32,background:'linear-gradient(135deg,#4a3728,#8b6f47)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🐝</div>
        <div>
          <div style={{fontSize:17,fontWeight:700,fontFamily:'Playfair Display,serif',color:'#2c1a0e',lineHeight:1}}>TexBee</div>
          <div style={{fontSize:9,color:'#8b6f47',letterSpacing:'0.08em',textTransform:'uppercase'}}>Document Translation</div>
        </div>
      </div>

      {/* Idle state */}
      {!loading && !docxBase64 && !isError && (
        <div className="fade-in" style={{textAlign:'center',width:'100%',maxWidth:520}}>
          <h1 style={{fontSize:46,fontFamily:'Playfair Display,serif',color:'#2c1a0e',lineHeight:1.15,marginBottom:12}}>
            PDF to Editable<br/><span style={{color:'#c4a882'}}>Word Doc</span>
          </h1>
          <p style={{fontSize:15,color:'#8b6f47',marginBottom:40,lineHeight:1.6}}>
            Upload a PDF or scanned image — get a perfectly formatted, editable Word document instantly.
          </p>
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()} style={{padding:'52px 40px',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
            <div style={{width:72,height:72,background:'linear-gradient(135deg,#f5efe8,#e8ddd0)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>📄</div>
            <div style={{fontSize:18,fontWeight:600,color:'#2c1a0e'}}>Drop your file here</div>
            <div style={{fontSize:13,color:'#a08060'}}>PDF, JPG, or PNG — scanned or digital</div>
            <div style={{marginTop:4,padding:'11px 28px',background:'#4a3728',color:'white',borderRadius:100,fontSize:13,fontWeight:600}}>Choose File</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="fade-in" style={{textAlign:'center'}}>
          <div style={{width:64,height:64,border:'4px solid #ede0ce',borderTopColor:'#c4a882',borderRadius:'50%',margin:'0 auto 28px'}} className="spin"/>
          <div style={{fontSize:20,fontWeight:600,color:'#2c1a0e',fontFamily:'Playfair Display,serif',marginBottom:8}}>Converting your document</div>
          <div style={{fontSize:14,color:'#8b6f47'}}>{status}</div>
        </div>
      )}

      {/* Success state */}
      {!loading && docxBase64 && (
        <div className="fade-in" style={{textAlign:'center',maxWidth:440}}>
          <div style={{width:80,height:80,background:'linear-gradient(135deg,#d4edda,#b8dfc4)',borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 24px'}}>✅</div>
          <div style={{fontSize:26,fontWeight:700,fontFamily:'Playfair Display,serif',color:'#2c1a0e',marginBottom:8}}>Your Word doc is ready!</div>
          <div style={{fontSize:14,color:'#8b6f47',marginBottom:32,lineHeight:1.6}}>
            Editable layout with images, fonts, and formatting preserved.
          </div>
          <button className="btn-download" onClick={handleDownload}>
            <span style={{fontSize:20}}>⬇</span>
            Download {fileName || 'document'}.docx
          </button>
          <br/>
          <button className="btn-upload-again" onClick={() => { setDocxBase64(''); setStatus(''); fileInputRef.current?.click() }}>
            ↑ Convert another file
          </button>
        </div>
      )}

      {/* Error state */}
      {!loading && isError && (
        <div className="fade-in" style={{textAlign:'center',maxWidth:440}}>
          <div style={{width:72,height:72,background:'#fee2e2',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,margin:'0 auto 20px'}}>⚠️</div>
          <div style={{fontSize:22,fontWeight:700,fontFamily:'Playfair Display,serif',color:'#2c1a0e',marginBottom:8}}>Something went wrong</div>
          <div style={{fontSize:13,color:'#dc2626',marginBottom:28,padding:'10px 16px',background:'#fee2e2',borderRadius:10}}>{status}</div>
          <button className="btn-upload-again" style={{marginTop:0}} onClick={() => { setIsError(false); setStatus(''); fileInputRef.current?.click() }}>
            ↑ Try again
          </button>
        </div>
      )}

      <input ref={fileInputRef} type='file' accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/*' onChange={handleUpload} style={{display:'none'}}/>
    </div>
  )
}
