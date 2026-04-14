export const STANDARD_STOP_WORDS = new Set([
  'a','about','above','after','again','against','all','am','an','and','any','are',
  'arent','as','at','be','because','been','before','being','below','between','both',
  'but','by','cant','cannot','could','couldnt','did','didnt','do','does','doesnt',
  'doing','dont','down','during','each','few','for','from','further','get','got',
  'had','hadnt','has','hasnt','have','havent','having','he','hed','hell','hes',
  'her','here','heres','hers','herself','him','himself','his','how','hows','i',
  'id','ill','im','ive','if','in','into','is','isnt','it','its','itself','lets',
  'me','more','most','mustnt','my','myself','no','nor','not','of','off','on',
  'once','only','or','other','ought','our','ours','ourselves','out','over','own',
  'same','shant','she','shed','shell','shes','should','shouldnt','so','some',
  'such','than','that','thats','the','their','theirs','them','themselves','then',
  'there','theres','these','they','theyd','theyll','theyre','theyve','this',
  'those','through','to','too','under','until','up','very','was','wasnt','we',
  'wed','well','were','weve','werent','what','whats','when','whens','where',
  'wheres','which','while','who','whos','whom','why','whys','will','with',
  'wont','would','wouldnt','you','youd','youll','youre','youve','your','yours',
  'yourself','yourselves','also','although','among','another','around','back',
  'become','becomes','becoming','behind','beside','besides','beyond','come',
  'comes','concerning','considering','despite','either','else','enough','even',
  'ever','every','everybody','everyone','everything','everywhere','except',
  'first','following','found','four','from','get','give','go','going','good',
  'great','high','however','including','indeed','instead','just','keep','large',
  'last','later','least','less','like','likely','long','low','made','make',
  'many','may','maybe','might','much','must','near','need','never','next',
  'none','nothing','now','often','one','part','perhaps','place','put','rather',
  'really','right','said','say','says','second','seen','several','since','six',
  'small','something','still','take','three','through','together','toward',
  'towards','two','upon','used','using','various','via','way','well','whether',
  'within','without','yet',
])

export function filterStopWords(query: string, customWords: string[] = []): string {
  const custom = new Set(customWords.map(w => w.toLowerCase().trim()))
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => {
      const clean = word.replace(/[^a-z]/g, '')
      return clean.length > 1 && !STANDARD_STOP_WORDS.has(clean) && !custom.has(clean)
    })
    .join(' ')
}
