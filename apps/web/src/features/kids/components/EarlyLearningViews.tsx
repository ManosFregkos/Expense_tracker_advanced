import { KIDS_ASSETS } from '../content/system'
import type { EarlyQuantity, QuantityRepresentation, SimpleSum } from '../early-learning/types'
import { useTVFocusable } from './TVFocusProvider'

function VisualAsset({ assetId, alt, className }: { assetId: string; alt: string; className?: string }) {
  const asset = KIDS_ASSETS.get(assetId)
  return asset?.url ? <img className={className} src={asset.url} alt={alt} draggable={false} /> : null
}

export function FingerQuantityView({ quantity }: { quantity: EarlyQuantity }) {
  return <VisualAsset assetId={`fingers-${quantity}`} alt={`${quantity} σηκωμένα δάχτυλα`} className="finger-quantity-image" />
}

export function QuantityDisplay({ quantity, objectAssetId, label }: { quantity: EarlyQuantity; objectAssetId: string; label?: string }) {
  return (
    <div className="quantity-display" role="img" aria-label={label ?? `${quantity} αντικείμενα`} data-quantity={quantity}>
      {Array.from({ length: quantity }, (_, index) => (
        <VisualAsset key={`${objectAssetId}-${index}`} assetId={objectAssetId} alt="" className="quantity-object" />
      ))}
    </div>
  )
}

export function NumeralCard({ quantity, autofocus, disabled, selected, correct, hint, onActivate }: {
  quantity: EarlyQuantity; autofocus?: boolean; disabled?: boolean; selected?: boolean; correct?: boolean; hint?: boolean; onActivate: () => void
}) {
  const focusable = useTVFocusable()
  return <button type="button" className="learning-card numeral-card" data-state={correct ? 'correct' : hint ? 'hint' : selected ? 'selected' : 'idle'}
    autoFocus={autofocus} data-tv-autofocus={autofocus ? 'true' : undefined} disabled={disabled} onClick={onActivate}
    aria-label={`Αριθμός ${quantity}`} {...focusable}><span>{quantity}</span></button>
}

export function QuantityChoiceCard({ representation, autofocus, disabled, selected, correct, hint, onActivate }: {
  representation: QuantityRepresentation; autofocus?: boolean; disabled?: boolean; selected?: boolean; correct?: boolean; hint?: boolean; onActivate: () => void
}) {
  const focusable = useTVFocusable()
  return <button type="button" className="learning-card quantity-choice-card" data-state={correct ? 'correct' : hint ? 'hint' : selected ? 'selected' : 'idle'}
    autoFocus={autofocus} data-tv-autofocus={autofocus ? 'true' : undefined} disabled={disabled} onClick={onActivate}
    aria-label={`${representation.quantity} αντικείμενα`} {...focusable}>
    {representation.type === 'FINGERS' ? <FingerQuantityView quantity={representation.quantity} /> :
      representation.type === 'OBJECTS' && representation.objectAssetId ? <QuantityDisplay quantity={representation.quantity} objectAssetId={representation.objectAssetId} /> :
        <span className="numeral-inline">{representation.quantity}</span>}
  </button>
}

export function SimpleSumView({ sum, showNumerals }: { sum: SimpleSum; showNumerals: boolean }) {
  return <div className="simple-sum-view" aria-label={`${sum.left} και ${sum.right} ακόμα`}>
    <div><FingerQuantityView quantity={sum.left} />{showNumerals ? <strong>{sum.left}</strong> : null}</div>
    <span aria-hidden="true">+</span>
    <div><FingerQuantityView quantity={sum.right} />{showNumerals ? <strong>{sum.right}</strong> : null}</div>
  </div>
}

export function FlagCard({ assetId, countryName, autofocus, disabled, selected, correct, hint, onActivate }: {
  assetId: string; countryName: string; autofocus?: boolean; disabled?: boolean; selected?: boolean; correct?: boolean; hint?: boolean; onActivate?: () => void
}) {
  const focusable = useTVFocusable()
  const state = correct ? 'correct' : hint ? 'hint' : selected ? 'selected' : 'idle'
  if (!onActivate) return <div className="learning-card flag-card" aria-label={`Σημαία: ${countryName}`}><VisualAsset assetId={assetId} alt={`Σημαία: ${countryName}`} className="flag-image" /></div>
  return <button type="button" className="learning-card flag-card" data-state={state} autoFocus={autofocus}
    data-tv-autofocus={autofocus ? 'true' : undefined} disabled={disabled} onClick={onActivate} aria-label={`Σημαία: ${countryName}`} {...focusable}>
    <VisualAsset assetId={assetId} alt={`Σημαία: ${countryName}`} className="flag-image" />
  </button>
}
