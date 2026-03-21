import './RotatingBackground.css'

export default function RotatingBackground() {
  const backgrounds = [
    '/backgrounds/bg1.jpg',
    '/backgrounds/bg2.jpg',
    '/backgrounds/bg3.jpg',
    '/backgrounds/bg4.jpg',
    '/backgrounds/bg5.jpg'
  ]

  return (
    <div className="rotating-background">
      {backgrounds.map((bg, idx) => (
        <div
          key={idx}
          className="bg-layer"
          style={{
            backgroundImage: `url('${bg}')`,
            animationDelay: `${idx * 12}s`
          }}
        />
      ))}
      <div className="gradient-overlay"></div>
    </div>
  )
}
