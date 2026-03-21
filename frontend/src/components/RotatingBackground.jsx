import { useState, useEffect } from 'react'
import './RotatingBackground.css'

export default function RotatingBackground() {
  const [backgrounds, setBackgrounds] = useState([
    '/backgrounds/bg1.jpg',
    '/backgrounds/bg2.jpg',
    '/backgrounds/bg3.jpg',
    '/backgrounds/bg4.jpg'
  ])

  useEffect(() => {
    fetch('/api/backgrounds')
      .then(res => res.json())
      .then(data => {
        if (data.backgrounds && data.backgrounds.length > 0) {
          setBackgrounds(data.backgrounds)
        }
      })
      .catch(() => {})
  }, [])

  const count = backgrounds.length
  const cycleDuration = 60
  const delay = count > 0 ? cycleDuration / count : 15

  return (
    <div className="rotating-background">
      {backgrounds.map((bg, idx) => (
        <div
          key={bg}
          className="bg-layer"
          style={{
            backgroundImage: `url('${bg}')`,
            animationDelay: `${idx * delay}s`,
            animationDuration: `${cycleDuration}s`
          }}
        />
      ))}
      <div className="gradient-overlay"></div>
    </div>
  )
}
