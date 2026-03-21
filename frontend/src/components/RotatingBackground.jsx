import { useState, useEffect, useRef } from 'react'
import './RotatingBackground.css'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function RotatingBackground() {
  const [current, setCurrent] = useState(0)
  const queue = useRef([])
  const RAW = 'https://raw.githubusercontent.com/daniwally/SP/main/backgrounds'
  const [backgrounds, setBackgrounds] = useState([
    `${RAW}/bg1.jpg`,
    `${RAW}/bg2.jpg`,
    `${RAW}/bg3.jpg`,
    `${RAW}/bg4.jpg`
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

  useEffect(() => {
    queue.current = shuffle(backgrounds)
    setCurrent(0)

    const interval = setInterval(() => {
      setCurrent(prev => {
        const next = prev + 1
        if (next >= queue.current.length) {
          queue.current = shuffle(backgrounds)
          return 0
        }
        return next
      })
    }, 12000)

    return () => clearInterval(interval)
  }, [backgrounds])

  const bg = queue.current[current] || backgrounds[0]

  return (
    <div className="rotating-background">
      <div
        key={`${current}-${bg}`}
        className="bg-layer bg-active"
        style={{ backgroundImage: `url('${bg}')` }}
      />
      <div className="gradient-overlay"></div>
    </div>
  )
}
