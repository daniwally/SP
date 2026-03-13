import './RotatingBackground.css'

export default function RotatingBackground() {
  const backgrounds = [
    '/static/backgrounds/bg1.jpg',
    '/static/backgrounds/bg2.jpg',
    '/static/backgrounds/bg3.jpg',
    '/static/backgrounds/bg4.jpg'
  ]

  return (
    <div className="rotating-background">
      {backgrounds.map((bg, idx) => (
        <div
          key={idx}
          className="bg-layer"
          style={{
            backgroundImage: `url('${bg}')`,
            animationDelay: `${idx * 6}s`
          }}
        />
      ))}
    </div>
  )
}
