import type { EverydayScenario, KidsDifficulty, WeatherTopic } from '@family-expense-tracker/shared'
import type { IllustratedAsset } from '../advanced'

type ChoiceSeed = readonly [id: string, symbol: string, narration: string]

export const WEATHER_ASSETS = new Map<string, IllustratedAsset>()

function weatherScenario(
  id: string,
  subtopic: WeatherTopic,
  narration: string,
  preferred: ChoiceSeed,
  distractors: ChoiceSeed[],
  explanationNarration: string,
  difficulty: KidsDifficulty,
): EverydayScenario {
  const completeDistractors =
    distractors.length >= 2
      ? distractors
      : [...distractors, ['spoon', '🥄', 'κουτάλι'] as const]
  const choices = [preferred, ...completeDistractors].map(([choiceId, symbol, choiceNarration]) => {
    const assetId = `weather-${id}-${choiceId}`
    WEATHER_ASSETS.set(assetId, {
      symbol,
      color: subtopic === 'SUN' ? '#fff8d9' : subtopic === 'COLD' || subtopic === 'SNOW' ? '#eaf7ff' : '#eef7f4',
      label: choiceNarration,
    })
    return { id: `${id}-${choiceId}`, assetId, narration: choiceNarration }
  })
  return {
    id,
    topic: 'WEATHER',
    subtopic,
    narration,
    choices,
    preferredChoiceId: choices[0]!.id,
    explanationNarration,
    difficulty,
    enabled: true,
    origin: 'SYSTEM',
  }
}

export const SYSTEM_WEATHER_SCENARIOS: EverydayScenario[] = [
  weatherScenario('rain-umbrella', 'RAIN', 'Βρέχει. Τι θα πάρουμε;', ['umbrella', '☂️', 'ομπρέλα'], [['pillow', '🛏️', 'μαξιλάρι']], 'Ναι! Όταν βρέχει, παίρνουμε ομπρέλα.', 1),
  weatherScenario('rain-raincoat', 'RAIN', 'Βρέχει. Τι φοράμε για να μη βραχούμε;', ['raincoat', '🧥', 'αδιάβροχο'], [['swimsuit', '🩱', 'μαγιό']], 'Μπράβο! Το αδιάβροχο μας κρατά στεγνούς στη βροχή.', 1),
  weatherScenario('rain-boots', 'RAIN', 'Έχει λακκούβες από τη βροχή. Τι φοράμε;', ['boots', '🥾', 'μπότες'], [['slippers', '🥿', 'παντόφλες'], ['socks', '🧦', 'κάλτσες']], 'Ναι! Στη βροχή φοράμε μπότες.', 2),
  weatherScenario('sun-hat', 'SUN', 'Έχει πολύ ήλιο. Τι φοράμε στο κεφάλι;', ['hat', '🧢', 'καπέλο'], [['scarf', '🧣', 'κασκόλ']], 'Μπράβο! Όταν έχει ήλιο, φοράμε καπέλο.', 1),
  weatherScenario('sun-sunglasses', 'SUN', 'Ο ήλιος είναι δυνατός. Τι βάζουμε στα μάτια;', ['sunglasses', '🕶️', 'γυαλιά ηλίου'], [['mittens', '🧤', 'γάντια']], 'Ναι! Τα γυαλιά ηλίου προστατεύουν τα μάτια μας.', 1),
  weatherScenario('sun-water', 'SUN', 'Έχει ζέστη. Τι παίρνουμε μαζί μας;', ['water', '💧', 'νερό'], [['blanket', '🛌', 'κουβέρτα'], ['pan', '🍳', 'τηγάνι']], 'Μπράβο! Όταν έχει ζέστη, πίνουμε νερό.', 2),
  weatherScenario('cold-jacket', 'COLD', 'Κάνει κρύο. Τι βάζουμε;', ['jacket', '🧥', 'ζεστό μπουφάν'], [['sandals', '🩴', 'σανδάλια']], 'Μπράβο! Όταν κάνει κρύο, φοράμε ζεστό μπουφάν.', 1),
  weatherScenario('cold-scarf', 'COLD', 'Κάνει κρύο στον λαιμό μας. Τι φοράμε;', ['scarf', '🧣', 'κασκόλ'], [['sunglasses', '🕶️', 'γυαλιά ηλίου'], ['apron', '🥼', 'ποδιά']], 'Ναι! Το κασκόλ κρατά τον λαιμό μας ζεστό.', 2),
  weatherScenario('cold-mittens', 'COLD', 'Κρυώνουν τα χέρια μας. Τι φοράμε;', ['mittens', '🧤', 'γάντια'], [['boots', '🥾', 'μπότες'], ['hat', '🧢', 'καπέλο ηλίου']], 'Μπράβο! Τα γάντια κρατούν τα χέρια μας ζεστά.', 2),
  weatherScenario('snow-boots', 'SNOW', 'Χιονίζει. Τι φοράμε στα πόδια;', ['snow-boots', '🥾', 'ζεστές μπότες'], [['flipflops', '🩴', 'σαγιονάρες']], 'Ναι! Στο χιόνι φοράμε ζεστές μπότες.', 1),
  weatherScenario('snow-hat', 'SNOW', 'Χιονίζει. Τι φοράμε στο κεφάλι;', ['wool-hat', '🧶', 'μάλλινο σκουφί'], [['sun-hat', '👒', 'καπέλο παραλίας'], ['goggles', '🥽', 'γυαλιά κολύμβησης']], 'Μπράβο! Στο χιόνι φοράμε ζεστό σκουφί.', 2),
  weatherScenario('snow-coat', 'SNOW', 'Χιονίζει και κάνει πολύ κρύο. Τι φοράμε;', ['coat', '🧥', 'χοντρό μπουφάν'], [['tshirt', '👕', 'κοντομάνικο'], ['swimsuit', '🩱', 'μαγιό']], 'Ναι! Το χοντρό μπουφάν μας κρατά ζεστούς στο χιόνι.', 2),
  weatherScenario('wind-jacket', 'WIND', 'Φυσάει δυνατά και κάνει δροσιά. Τι φοράμε;', ['windbreaker', '🧥', 'ζακέτα'], [['swimsuit', '🩱', 'μαγιό']], 'Μπράβο! Όταν φυσά και κάνει δροσιά, φοράμε ζακέτα.', 1),
  weatherScenario('wind-hold-hat', 'WIND', 'Ο αέρας φυσά δυνατά. Τι κρατάμε καλά;', ['hold-hat', '🧢', 'το καπέλο μας'], [['spoon', '🥄', 'ένα κουτάλι'], ['pillow', '🛏️', 'ένα μαξιλάρι']], 'Ναι! Στον δυνατό αέρα κρατάμε καλά το καπέλο μας.', 2),
  weatherScenario('wind-kite', 'WIND', 'Φυσάει έξω. Με τι μπορούμε να παίξουμε;', ['kite', '🪁', 'χαρταετό'], [['pillow', '🛏️', 'μαξιλάρι'], ['pan', '🍳', 'τηγάνι']], 'Μπράβο! Ο αέρας βοηθά τον χαρταετό να πετάξει.', 2),
]
