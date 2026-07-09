import { useState } from 'react'

export default function Flashcards({ cards }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards || cards.length === 0) return null

  const card = cards[index]

  function next() {
    setFlipped(false)
    setIndex((i) => (i + 1) % cards.length)
  }

  function prev() {
    setFlipped(false)
    setIndex((i) => (i - 1 + cards.length) % cards.length)
  }

  return (
    <div className="card-stage">
      <div className="flashcard-wrap">
        <div className="flashcard" onClick={() => setFlipped((f) => !f)}>
          <span className="label">{flipped ? 'Answer' : 'Question'}</span>
          <span>{flipped ? card.answer : card.question}</span>
        </div>
      </div>
      {flipped && card.source && (
        <p className="source-note">Source: {card.source}</p>
      )}
      <div className="nav-row">
        <button className="secondary" onClick={prev}>← Prev</button>
        <span className="counter">{index + 1} / {cards.length}</span>
        <button className="secondary" onClick={next}>Next →</button>
      </div>
    </div>
  )
}
