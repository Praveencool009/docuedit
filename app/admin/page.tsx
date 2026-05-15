'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [pwd, setPwd] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchStats() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin?pwd=' + encodeURIComponent(pwd))
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStats(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }

  const card = (label: string, value: any, color = '#2c1a0e') => (
    <div style={{background:'white',borderRadius:12,padding:'20px 24px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',minWidth:120}}>
      <div style={{fontSize:28,fontWeight:700,color,fontFamily:'Inter,sans-serif'}}>{value}</div>
      <div style={{fontSize:12,color:'#8b6f47',marginTop:4,fontFamily:'Inter,sans-serif'}}>{label}</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f8f6f3',padding:'40px 32px',fontFamily:'Inter,sans-serif'}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <h1 style={{fontSize:28,fontWeight:700,color:'#2c1a0e',marginBottom:28,fontFamily:'Playfair Display,serif'}}>
          🐝 TexBee Admin
        </h1>

        {!stats && (
          <div style={{display:'flex',gap:10,maxWidth:360}}>
            <input
              type="password"
              placeholder="Admin password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchStats()}
              style={{flex:1,padding:'10px 14px',borderRadius:10,border:'1.5px solid #ddd',fontSize:14,outline:'none'}}
            />
            <button
              onClick={fetchStats}
              disabled={loading}
              style={{padding:'10px 20px',background:'#4a3728',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}
            >
              {loading ? '...' : 'Login'}
            </button>
          </div>
        )}

        {error && <div style={{color:'#dc2626',marginTop:12,fontSize:13}}>{error}</div>}

        {stats && (
          <div>
            {/* Summary cards */}
            <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:32}}>
              {card('Total Conversions', stats.total)}
              {card('Today', stats.today, '#1d4ed8')}
              {card('This Week', stats.thisWeek, '#7c3aed')}
              {card('Successful', stats.success, '#16a34a')}
              {card('Failed', stats.failed, '#dc2626')}
            </div>

            {/* By file type */}
            <div style={{background:'white',borderRadius:12,padding:'20px 24px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',marginBottom:24}}>
              <div style={{fontSize:14,fontWeight:600,color:'#2c1a0e',marginBottom:14}}>By File Type</div>
              <div style={{display:'flex',gap:16}}>
                {stats.byType.map((t: any) => (
                  <div key={t.file_type} style={{fontSize:13,color:'#4a3728'}}>
                    <span style={{fontWeight:700}}>{t.n}</span> {t.file_type}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent conversions */}
            <div style={{background:'white',borderRadius:12,padding:'20px 24px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:600,color:'#2c1a0e'}}>Recent Conversions</div>
                <button onClick={fetchStats} style={{fontSize:12,color:'#8b6f47',background:'none',border:'none',cursor:'pointer'}}>↻ Refresh</button>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid #f0ece6'}}>
                      {['Time','File','Type','Status','IP','Error'].map(h => (
                        <th key={h} style={{textAlign:'left',padding:'6px 10px',color:'#8b6f47',fontWeight:600}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((r: any) => (
                      <tr key={r.id} style={{borderBottom:'1px solid #faf8f5'}}>
                        <td style={{padding:'7px 10px',color:'#4a3728',whiteSpace:'nowrap'}}>{new Date(r.timestamp).toLocaleString()}</td>
                        <td style={{padding:'7px 10px',color:'#4a3728',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.file_name}</td>
                        <td style={{padding:'7px 10px',color:'#4a3728'}}>{r.file_type}</td>
                        <td style={{padding:'7px 10px'}}>
                          <span style={{padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:600,background:r.success?'#dcfce7':'#fee2e2',color:r.success?'#16a34a':'#dc2626'}}>
                            {r.success ? 'OK' : 'FAIL'}
                          </span>
                        </td>
                        <td style={{padding:'7px 10px',color:'#8b6f47'}}>{r.ip}</td>
                        <td style={{padding:'7px 10px',color:'#dc2626',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.error || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
