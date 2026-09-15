// Mobilitets-fanen (opvarmning + daglig mobilitet) — udskilt fra
// AthleteView.jsx (ordre 232 · commit 2) som sin egen lazy-loadede chunk,
// samme LazyBoundary-mønster som Dashboard.jsx's fire faner (130/163/228).
// Ren udflytning af JSX'en + de datatabeller/hjælpefunktioner der KUN bruges
// her — ingen logikændring, kun frie variable gjort eksplicitte som props.
// Delt tilstand (mobilityMode, warmupFocus, timerSeconds, ...) ejes fortsat
// af AthleteView (en effekt der auto-detekterer warmupFocus, og
// verify:athlete-rest-timer-drift's statiske timer-effekt-tjek, læser dem
// begge der) og sendes ned som props.
import { foldNavn } from '../exerciseNames'
import CountdownRing from './CountdownRing'
import { s } from '../athleteShared'

const WARMUP_BASE = {
  'Squat': [
    {
      slot: 'Hofte- og ankelmobilitet',
      options: [
        {
          id: 'sq-mob-1',
          name: 'Hoftecirkler',
          desc: 'Stå på ét ben og løft det andet knæ til hoftehøjde. Lav store, langsomme cirkler med hoften — udad og bagud. Åbner hofteleddet i alle retninger og forbereder den dybe squat.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-mob-2',
          name: 'Ankel-vægstræk',
          desc: 'Stå med tåen ca. 10 cm fra en væg og bøj knæet fremad, til det rører væggen — hælen skal blive i gulvet. Flyt tåen gradvist længere væk. Lader anklen bøje nok til at knæet kan vandre frem over tæerne — afgørende for din squat-dybde.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-mob-3',
          name: '90/90 hofterotation',
          desc: 'Sid på gulvet med det ene ben bøjet foran dig (90°) og det andet ud til siden (90°). Skub forsigtigt hoften frem mod det forreste ben og hold. Rammer både udad- og indadrotation i hoften — vigtigt for at komme dybt i squatten.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'sq-mob-4',
          name: 'Hoftebøjer-stræk mod væg',
          desc: 'Sæt det ene knæ mod en væg med skinnebenet op ad væggen, og sæt den anden fod fladt foran dig i et stort udfald. Hold ryggen rank og skub hoften frem, til du mærker stræk foran i hoften og låret. Løsner hoftebøjeren, der spænder op og trækker dig fremover under squat.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
      ],
    },
    {
      slot: 'Balle- og låraktivering',
      options: [
        {
          id: 'sq-akt-1',
          name: 'Hofteløft',
          desc: 'Lig på ryggen med bøjede knæ og fødderne fladt i gulvet. Skub hofterne op og klem ballerne hårdt i toppen — hold et sekund og sænk roligt. Aktiverer ballerne, der er den primære motor i squatten.',
          label: '15 reps',
          type: 'reps',
        },
        {
          id: 'sq-akt-2',
          name: 'Muslingen med elastik',
          desc: 'Lig på siden med et elastik om knæene, knæene bøjet ca. 45° og hælene samlet. Løft det øverste knæ som en musling der åbner sig — hold et sekund øverst. Aktiverer den mellemste ballemuskel, der holder knæene ude i squat.',
          label: '12 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-akt-3',
          name: 'Hofteløft på ét ben',
          desc: 'Lig på ryggen med det ene ben strakt og det andet bøjet med foden i gulvet. Skub hoften op og hold ryggen rank — undgå at dreje. Styrker ballerne ét ben ad gangen og afslører forskelle fra side til side.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-akt-4',
          name: 'Knæpres udad mod væg',
          desc: 'Stå i en let squat med ryggen mod en væg. Pres begge knæ aktivt udad — som om du vil sprede gulvet under fødderne — og hold. Indøver det udadpres i knæene, der er afgørende i hele squatten.',
          label: '20 sek',
          type: 'timer',
          duration: 20,
        },
      ],
    },
    {
      slot: 'Squat-mønster',
      options: [
        {
          id: 'sq-mov-1',
          name: 'Squat uden vægt med pause',
          desc: 'Stå i skulderbredde. Sæt dig så dybt ned som muligt og hold 2-3 sekunder forneden — hælene skal blive i gulvet. Fokus på at åbne hofterne og holde brystet oppe.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'sq-mov-2',
          name: 'Squat til bænk',
          desc: 'Sæt en bænk bag dig i squathøjde. Sæt dig roligt ned, til du rører bænken let — hold et sekund og rejs dig. Hjælper dig med at ramme dybde og position uden at tænke over det.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'sq-mov-3',
          name: 'Squat med hælhøjning',
          desc: 'Sæt hælene på en vægtskive eller et sammenrullet håndklæde. Sæt dig dybt ned med rank ryg og knæene pegende over tæerne. Tager anklen ud af ligningen og giver dig adgang til dybde og position med det samme.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'sq-mov-4',
          name: 'Tempo-squat (3-0-1)',
          desc: 'Sæt dig ned over 3 sekunder, ingen pause forneden, rejs dig normalt. Hold fuldt styr på vej ned — undgå at "falde" de sidste centimeter. Bygger kontrol og kropsbevidsthed i hele bevægelsen.',
          label: '6 reps',
          type: 'reps',
        },
      ],
    },
  ],

  'Bænkpres': [
    {
      slot: 'Skulder- og brystmobilitet',
      options: [
        {
          id: 'bp-mob-1',
          name: 'Brystryg over skumrulle',
          desc: 'Læg en skumrulle på tværs under øvre ryg mellem skulderbladene. Læn forsigtigt bagover med hænderne bag nakken og åbn brystet mod loftet — flyt rullen et par centimeter op og gentag. Giver bagoverbøjning i brystryggen, der giver bedre bue og skulderposition i bænk.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'bp-mob-2',
          name: 'Bryststræk mod væg',
          desc: 'Sæt underarmen lodret op ad en væg med albuen i skulderhøjde. Drej langsomt overkroppen væk fra væggen, til du mærker stræk i brystet. Hold og træk vejret dybt. Åbner brystmusklen, der strammer op ved hyppig bænk.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'bp-mob-3',
          name: 'Skulderrotation med håndklæde',
          desc: 'Hold et håndklæde bredt foran dig med strakte arme. Før det langsomt over hovedet og ned bag ryggen i en rolig bue — start så bredt at det er behageligt, og gør grebet smallere lidt efter lidt. Mobiliserer skulderen i hele dens bevægelse.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'bp-mob-4',
          name: 'Skuldercirkler',
          desc: 'Stå oprejst med armene langs siden. Lav store, langsomme cirkler med skuldrene — frem, op, bagud og ned. Løsner skulderen og øger blodgennemstrømningen i de små skuldermuskler inden bænk.',
          label: '10 reps pr. retning',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Skulderblad- og rotatoraktivering',
      options: [
        {
          id: 'bp-akt-1',
          name: 'Skulderblads-push-up',
          desc: 'Stå i push-up-position med strakte arme, og lad skulderbladene synke passivt sammen. Pres dem derefter aktivt fra hinanden og rund øvre ryg. Hold armene strakte hele vejen. Træner kontrol over skulderbladene — afgørende for en stabil og sikker bænk.',
          label: '12 reps',
          type: 'reps',
        },
        {
          id: 'bp-akt-2',
          name: 'Elastik-træk fra hinanden',
          desc: 'Hold et elastik foran dig i skulderbredde med strakte arme. Træk det fra hinanden og før hænderne ud til siden, så skulderbladene trækkes sammen. Aktiverer øvre ryg og de små skuldermuskler, der holder skulderen stabil under pres.',
          label: '15 reps',
          type: 'reps',
        },
        {
          id: 'bp-akt-3',
          name: 'Udadrotation med elastik',
          desc: 'Fastgør et elastik i hoftehøjde og stå med siden til. Hold overarmen tæt mod kroppen med albuen bøjet 90° og drej underarmen udad mod modstanden — hold et sekund. Aktiverer de små skuldermuskler, der ofte er svage og skadestruede hos bænkpressere.',
          label: '12 reps pr. side',
          type: 'reps',
        },
        {
          id: 'bp-akt-4',
          name: 'YWT-løft på maven',
          desc: 'Lig på maven og løft armene i Y-, W- og T-form ved at klemme skulderbladene sammen — hold 2 sekunder i hver. Aktiverer hele øvre rygs stabilisatorer i én øvelse.',
          label: '8 reps pr. position',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Pres- og bænkmønster',
      options: [
        {
          id: 'bp-mov-1',
          name: 'Push-up med pause',
          desc: 'Sænk dig ned, til brystet næsten rører gulvet, og hold 2 sekunder — albuerne tæt mod kroppen som i bænk. Pres dig op med fuldt styr. Bygger den samme spænding og tempo-kontrol du skal bruge under bænk.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'bp-mov-2',
          name: 'Tom stang-bænk med fokus på opsætning',
          desc: 'Brug den tomme stang til at øve bue, ben-drive og at trække skulderbladene sammen. Tag 2-3 sæt med fuldt fokus på opsætningen — ikke på at løfte tungt. Mærk alt falde på plads, inden du lægger vægt på.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'bp-mov-3',
          name: 'Pike push-up',
          desc: 'Start i push-up-position og gå med hænderne tæt mod fødderne, så hoften er høj. Bøj albuerne og sænk issen mod gulvet — pres tilbage op. Træner skulderen fra en anden vinkel og forbedrer stabiliteten i pres-øvelser.',
          label: '8 reps',
          type: 'reps',
        },
      ],
    },
  ],

  'Dødløft — Konventionel': [
    {
      slot: 'Ryg- og hoftemobilitet',
      options: [
        {
          id: 'dk-mob-1',
          name: 'Katte-kamel',
          desc: 'Kom på alle fire med håndleddene under skuldrene og knæene under hofterne. Synk maven mod gulvet og løft brystet (kamel) — afrund derefter ryggen helt og pres lænden mod loftet (kat). Varmer rygsøjlen op i hele bevægelsen.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'dk-mob-2',
          name: 'Stående baglårsstræk med sving',
          desc: 'Stå med let bøjede knæ og lad overkroppen hænge afslappet ned mod gulvet. Sving langsomt overkroppen fra side til side og mærk stræk langs baglårene. Forbereder baglår og lænd dynamisk til hoftebøjningen.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'dk-mob-3',
          name: 'Hoftebøjer-stræk i udfald',
          desc: 'Tag et langt skridt frem og sænk det bageste knæ mod gulvet. Hold overkroppen oprejst og skub hoften frem, til du mærker stræk foran i det bageste lår og hofte. Åbner hoftebøjeren, der ellers hæmmer fuldt hoftestræk i toppen af dødløft.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'dk-mob-4',
          name: 'Jefferson curl',
          desc: 'Stå oprejst og rul langsomt ned fra nakken — hagen mod brystet, ryggen rundes, fingrene hænger mod gulvet. Rejs dig igen i omvendt rækkefølge. Hold det roligt og kontrolleret; mobiliserer hele rygsøjlen og baglårene samlet.',
          label: '6 reps',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Balle- og baglåraktivering',
      options: [
        {
          id: 'dk-akt-1',
          name: 'Hofteløft',
          desc: 'Lig på ryggen med bøjede knæ og fødderne fladt i gulvet. Skub hofterne op og klem ballerne hårdt i toppen — hold et sekund. Aktiverer ballerne, der driver hoftestrækket i toppen af dødløft.',
          label: '15 reps',
          type: 'reps',
        },
        {
          id: 'dk-akt-2',
          name: 'Benløft på maven',
          desc: 'Lig på maven med strakte ben. Spænd ballerne og løft ét ben fra gulvet med strakt knæ — hold 2 sekunder. Skift ben. Aktiverer ballemusklen og baglåret isoleret uden at belaste lænden.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'dk-akt-3',
          name: 'Hoftebøjning på ét ben',
          desc: 'Stå på ét ben og fold dig forover fra hoften med neutral ryg — stræk det frie ben bagud som modvægt. Kom op igen ved at klemme ballemusklen. Aktiverer og koordinerer balle, baglår og core ét ben ad gangen.',
          label: '8 reps pr. side',
          type: 'reps',
        },
        {
          id: 'dk-akt-4',
          name: 'Nordic curl (let)',
          desc: 'Sæt fødderne fast under en stang eller en tung bænk. Sænk dig langsomt fremad fra knæene med rank krop og brug hænderne til at bremse faldet — kom aktivt tilbage. Træner baglårene på vej ned i netop den vinkel de arbejder i under dødløft.',
          label: '5 reps',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Hoftebøjnings-mønster',
      options: [
        {
          id: 'dk-mov-1',
          name: 'Hoftebøjning mod væg',
          desc: 'Stå ca. 30 cm fra en væg. Pres bagdelen bagud og rør væggen let, hold ryggen neutral og knæene let bøjede. Lær at bøje fra hoften — ikke fra lænden — inden du lægger vægt på stangen.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'dk-mov-2',
          name: 'Good morning uden vægt',
          desc: 'Stå oprejst med hænderne bag nakken. Fold langsomt overkroppen forover fra hoften med let bøjede knæ og neutral ryg — stop når du mærker stræk i baglårene. Rejs dig ved at spænde ballerne. Indøver hoftebøjningen med fuld kropsbevidsthed.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'dk-mov-3',
          name: 'RDL med tom stang',
          desc: 'Hold stangen foran lårene med skulderbredt greb. Skub hofterne bagud og sænk stangen langs lårene med neutral ryg — stop ved et moderat stræk i baglårene. Rejs dig og pres hofterne frem i toppen. Opvarmning og indstilling af bevægelsen i ét.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'dk-mov-4',
          name: 'Dødløft med tom stang',
          desc: 'Sæt stangen på gulvet og tag fat med dit normale greb. Sæt dig ned i startposition, spænd core og de brede rygmuskler — "bøj stangen" mentalt — og rejs dig langsomt over 3 sekunder. Mærk positionen og spændingen inden du lægger vægt på.',
          label: '5 reps',
          type: 'reps',
        },
      ],
    },
  ],

  'Dødløft — Sumo': [
    {
      slot: 'Hofte- og lyskemobilitet',
      options: [
        {
          id: 'ds-mob-1',
          name: 'Sumo squat med pause',
          desc: 'Stå bredt med tæerne pegende udad — samme bredde som din sumo-stance. Sæt dig roligt ned og hold 3 sekunder fornede. Aktiverer lysken og åbner hofteleddet til din stance.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'ds-mob-2',
          name: 'Frøstræk',
          desc: 'Kom ned på alle fire og glid begge knæ bredt ud til siden med tæerne pegende udad. Skub forsigtigt hoften bagud og ned, og lad lysken strække. Hold og træk vejret dybt ind i det stramme område.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'ds-mob-3',
          name: 'Inderlårsstræk siddende',
          desc: 'Sid på gulvet med benene spredt bredt ud til siderne. Læn dig langsomt forover fra hoften med rank ryg og hold. Mærk strækket i inderlårene — afgørende for sumo-stance.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'ds-mob-4',
          name: 'Sideudfald',
          desc: 'Stå med benene i skulderbredde. Tag et langt skridt til siden og sænk dig ned over det ene bøjede ben, mens det andet er strakt. Skub tilbage til midten. Strækker inderlårene dynamisk og forbereder hoften til at åbne udad i sumo.',
          label: '8 reps pr. side',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Balle- og hofteaktivering',
      options: [
        {
          id: 'ds-akt-1',
          name: 'Muslingen med elastik',
          desc: 'Lig på siden med et elastik om knæene, knæene bøjet ca. 45° og hælene samlet. Løft det øverste knæ som en musling der åbner sig — hold et sekund. Aktiverer den mellemste ballemuskel, der trækker knæene ud i sumo-stance.',
          label: '15 reps pr. side',
          type: 'reps',
        },
        {
          id: 'ds-akt-2',
          name: 'Knæ til siden på alle fire',
          desc: 'Kom på alle fire med håndleddene under skuldrene. Løft det ene knæ ud til siden til ca. 90° med hoften stabil — hold et sekund og sænk roligt. Rammer hoftens udadføring og udadrotation direkte i det mønster sumo kræver.',
          label: '12 reps pr. side',
          type: 'reps',
        },
        {
          id: 'ds-akt-3',
          name: 'Sidegang med elastik',
          desc: 'Læg et elastik om knæene. Sæt dig i en let sumo-squat og tag korte skridt til siden med konstant spænding i elastikken — knæene peger ud hele vejen. Aktiverer den mellemste ballemuskel og sætter mønstret for udadpres i sumo.',
          label: '10 skridt pr. side',
          type: 'reps',
        },
        {
          id: 'ds-akt-4',
          name: 'Benløft til siden med elastik',
          desc: 'Læg et elastik om knæene og hold fast i en væg for balance. Løft det ene ben ud til siden mod modstanden — hold et sekund og sænk kontrolleret. Isoleret træning af hoftens udadføring, der forbereder dig til at presse knæene ud i sumo.',
          label: '12 reps pr. side',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Sumo-stance-mønster',
      options: [
        {
          id: 'ds-mov-1',
          name: 'Sumo dødløft med tom stang',
          desc: 'Tag din normale sumo-stance med tæerne udad og grebet smalt inden for benene. Sæt dig ned i startposition og mærk at knæene peger over tæerne — spænd ydersiden af hofterne. Rejs dig langsomt og pres hoften frem i toppen.',
          label: '6 reps',
          type: 'reps',
        },
        {
          id: 'ds-mov-2',
          name: 'Sumo RDL med tom stang',
          desc: 'Stå i din sumo-stance med tæerne udad. Skub hofterne bagud og sænk overkroppen forover med neutral ryg — knæene forbliver let bøjede. Mærk baglår og inderlår strække. Kombinerer hoftebøjning med den brede stance.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'ds-mov-3',
          name: 'Sumo squat fra side til side',
          desc: 'Stå i sumo-stance og sæt dig ned til parallel. Gynge forsigtigt fra side til side og skift vægten fra det ene ben til det andet. Mærk lysken åbne og find din optimale knæ-over-tå-linje i stancen.',
          label: '10 reps (5 pr. side)',
          type: 'reps',
        },
      ],
    },
  ],
};

const WARMUP_ADDONS = {
  'Hofte / baller': {
    slot: 'Hofte / baller',
    options: [
      {
        id: 'add-hofte-1',
        name: '90/90 hofterotation',
        desc: 'Sid på gulvet med det ene ben bøjet foran dig (90°) og det andet ud til siden (90°). Skub forsigtigt hoften frem mod det forreste ben og hold — skift side. Rammer både udad- og indadrotation i hoften samlet.',
        label: '30 sek pr. side',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-hofte-2',
        name: 'Due-stræk',
        desc: 'Fra alle fire, før det ene knæ frem og læg skinnebenet skråt foran dig på gulvet. Sænk hofterne og læn overkroppen frem — undgå at dreje ryggen. Dybt stræk af den dybe ballemuskel og hoften, der rammer det ingen andre stræk når.',
        label: '30 sek pr. side',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-hofte-3',
        name: 'Hoftecirkler',
        desc: 'Stå på ét ben, løft det andet knæ og lav store, langsomme cirkler med hoften — udad og bagud. Åbner hofteleddet dynamisk i alle retninger og smører leddet.',
        label: '10 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-hofte-4',
        name: 'Hofteløft med pause',
        desc: 'Lig på ryggen med bøjede knæ. Skub hofterne op og klem ballerne hårdt — hold 5 sekunder i toppen og sænk roligt. Kombinerer stræk af hoftebøjeren med direkte, bevidst balleaktivering.',
        label: '8 reps',
        type: 'reps',
      },
    ],
  },

  'Lyske / inderlår': {
    slot: 'Lyske / inderlår',
    options: [
      {
        id: 'add-lyske-1',
        name: 'Frøstræk',
        desc: 'Kom ned på alle fire og glid begge knæ bredt ud til siden med tæerne udad. Skub forsigtigt hoften bagud og ned og lad lysken strække. Hold og vejrtræk dybt ind i det stramme område.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-lyske-2',
        name: 'Sideudfald',
        desc: 'Stå med benene i skulderbredde. Tag et langt skridt til siden og sænk dig ned over det ene bøjede ben, mens det andet er strakt. Skub tilbage til midten. Strækker inderlårene dynamisk og mærker dem arbejde i bevægelse.',
        label: '8 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-lyske-3',
        name: 'Inderlårsstræk siddende',
        desc: 'Sid på gulvet med benene spredt bredt ud til siderne. Læn dig langsomt forover fra hoften med rank ryg og hold. Mærk strækket i inderlårene — hold positionen og træk vejret roligt.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-lyske-4',
        name: 'Sumo squat fra side til side',
        desc: 'Stå bredt med tæerne udad og sæt dig ned i sumo-squat. Gynge forsigtigt fra side til side og lad inderlårene åbne dynamisk. God til akut stramhed, der giver sig med bevægelse.',
        label: '10 reps',
        type: 'reps',
      },
    ],
  },

  'Lænde': {
    slot: 'Lænde',
    options: [
      {
        id: 'add-laende-1',
        name: 'Katte-kamel',
        desc: 'Kom på alle fire. Synk maven mod gulvet og løft brystet (kamel) — afrund derefter ryggen helt og pres lænden mod loftet (kat). Mobiliserer hele rygsøjlen og løsner stivhed i lænden.',
        label: '10 reps',
        type: 'reps',
      },
      {
        id: 'add-laende-2',
        name: 'Liggende knæ-til-bryst',
        desc: 'Lig på ryggen. Træk det ene knæ op mod brystet og hold det med begge hænder — det andet ben bliver strakt i gulvet. Hold og skift. Let aflastnings-øvelse for lænd og bækken.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-laende-3',
        name: 'Liggende rygrotation',
        desc: 'Lig på ryggen med bøjede knæ. Lad begge knæ falde langsomt til den ene side, mens skuldrene bliver i gulvet — kom roligt tilbage og fald til den anden side. Roterer og løsner lænden.',
        label: '8 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-laende-4',
        name: 'Barnets stilling',
        desc: 'Sæt dig tilbage på hælene med knæene spredt og stræk armene frem på gulvet. Lad panden hvile i gulvet og træk vejret dybt — mærk lænden åbne for hver udånding. Passiv aflastning der virker godt ved akut stivhed.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
    ],
  },

  'Øvre ryg': {
    slot: 'Øvre ryg',
    options: [
      {
        id: 'add-oevreR-1',
        name: 'Brystryg over skumrulle',
        desc: 'Læg en skumrulle på tværs under øvre ryg. Læn forsigtigt bagover med hænderne bag nakken og åbn brystet mod loftet — flyt rullen op ad ryggen og gentag. Giver bagoverbøjning i brystryggen, som er afgørende for bænk og opsætning i dødløft.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-oevreR-2',
        name: 'Brystryg-rotation siddende',
        desc: 'Sid på gulvet og hold en stang eller et håndklæde vandret bag nakken. Drej langsomt overkroppen til den ene side og hold — undgå at dreje fra lænden. Forbedrer rotationen i brystryggen, som er vigtig for bænk-opsætning og for at få fat med de brede rygmuskler i dødløft.',
        label: '8 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-oevreR-3',
        name: 'Elastik-træk fra hinanden',
        desc: 'Hold et elastik foran dig i skulderbredde med strakte arme. Træk det fra hinanden og hold 2 sekunder med skulderbladene trukket sammen. Aktiverer musklerne mellem skulderbladene, der holder øvre ryg stabil under alle tunge løft.',
        label: '15 reps',
        type: 'reps',
      },
      {
        id: 'add-oevreR-4',
        name: 'YWT-løft på maven',
        desc: 'Lig på maven og løft armene i Y-, W- og T-form ved at klemme skulderbladene sammen — hold 2 sekunder i hver. Aktiverer hele øvre rygs stabilisatorer og de små skuldermuskler på én gang.',
        label: '8 reps pr. position',
        type: 'reps',
      },
    ],
  },

  'Ankel': {
    slot: 'Ankel',
    options: [
      {
        id: 'add-ankel-1',
        name: 'Ankelcirkler',
        desc: 'Sid på en bænk eller stå på ét ben. Løft foden let og lav store, langsomme cirkler med anklen — begge retninger. Løsner ledbåndet og øger ledvæsken i anklen inden belastning.',
        label: '10 reps pr. retning pr. side',
        type: 'reps',
      },
      {
        id: 'add-ankel-2',
        name: 'Ankel-vægstræk',
        desc: 'Stå med tåen ca. 10 cm fra en væg og bøj knæet fremad, til det rører væggen — hælen skal blive i gulvet. Flyt tåen gradvist længere væk. Lader anklen bøje nok til knæ-over-tå, som er afgørende for squat-dybde.',
        label: '10 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-ankel-3',
        name: 'Langsom hælsænkning',
        desc: 'Stå med forfoden på en vægtskive eller en lav forhøjning. Rejs dig på tå og sænk derefter hælen langsomt ned under skiven over 3 sekunder. Strækker akillessenen og anklen på vej ned — effektiv ved stive ankler.',
        label: '10 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-ankel-4',
        name: 'Ankel-glid med elastik',
        desc: 'Bind et elastik fast i lav højde og læg løkken stramt om anklens forside. Træd fremad, så elastikken trækker anklen bagud, og bøj knæet frem over tåen gentagne gange. Elastikken løsner anklen mere end et stræk alene.',
        label: '10 reps pr. side',
        type: 'reps',
      },
    ],
  },

  'Knæ': {
    slot: 'Knæ',
    options: [
      {
        id: 'add-knae-1',
        name: 'Lårstræk stående',
        desc: 'Stå på ét ben, hold om anklen på det bøjede ben og træk hælen mod sædet — hold knæene samlet. Rør en væg med en finger for balance. Strækker forlåret, der belastes hårdt i squat og påvirker knæets bevægelighed.',
        label: '30 sek pr. side',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-knae-2',
        name: 'Bensving',
        desc: 'Stå ved en væg og sving det ene ben frem og tilbage som et pendul — afslappet, roligt og med stigende udslag. Løsner hoften og knæet dynamisk og øger blodgennemstrømning i knæleddet inden belastning.',
        label: '15 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-knae-3',
        name: 'Vægstøttet squat med knæ-styring',
        desc: 'Stå med ryggen mod en væg og glid langsomt ned i en halv squat. Pres bevidst knæene udad over den 2. tå og hold 3 sekunder — rejs dig. Træner korrekt knæ-styring og aflaster knæets inderside.',
        label: '8 reps',
        type: 'reps',
      },
      {
        id: 'add-knae-4',
        name: 'Knæstræk med elastik',
        desc: 'Fastgør et elastik bag om knæet og træd fremad, så det trækker. Stå på ét ben med let bøjet knæ og stræk det helt ud — spænd låret. Aktiverer den indre lårmuskel, der stabiliserer knæet under løft.',
        label: '15 reps pr. side',
        type: 'reps',
      },
    ],
  },

  'Skulder': {
    slot: 'Skulder',
    options: [
      {
        id: 'add-skulder-1',
        name: 'Skuldercirkler',
        desc: 'Stå oprejst med armene langs siden. Lav store, langsomme cirkler med skuldrene fremad og bagud. Løsner skulderen og øger blodgennemstrømningen i de små skuldermuskler inden bænk eller tunge dødløft.',
        label: '10 reps pr. retning',
        type: 'reps',
      },
      {
        id: 'add-skulder-2',
        name: 'Skulderrotation med håndklæde',
        desc: 'Hold et håndklæde bredt foran dig med strakte arme. Før det langsomt over hovedet og ned bag ryggen i en rolig bue — gør grebet smallere lidt efter lidt. Mobiliserer skulderen i hele dens bevægelse.',
        label: '10 reps',
        type: 'reps',
      },
      {
        id: 'add-skulder-3',
        name: 'Skulderstræk over kroppen',
        desc: 'Træk den ene arm vandret hen foran brystet med den modsatte hånd og pres let. Mærk stræk i den bageste del af skulderen. Bagsiden af skulderen er ofte stram hos bænkpressere og dødløftere.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-skulder-4',
        name: 'Udadrotation med elastik',
        desc: 'Fastgør et elastik i hoftehøjde. Hold overarmen tæt mod kroppen med albuen bøjet 90° og drej underarmen udad mod modstanden — hold et sekund. Aktiverer de små skuldermuskler, der beskytter skulderen under både pres og træk.',
        label: '12 reps pr. side',
        type: 'reps',
      },
    ],
  },

  'Nakke / trapez': {
    slot: 'Nakke / trapez',
    options: [
      {
        id: 'add-nakke-1',
        name: 'Nakkestræk til siden',
        desc: 'Sid eller stå oprejst. Lad øret falde roligt mod skulderen — uden at tvinge. Hold og mærk stræk langs siden af nakken og ned i øvre trapez. Løsner de muskler, der strammer op af stangbæring og tunge dødløft.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-nakke-2',
        name: 'Hage tilbage',
        desc: 'Sid oprejst og træk hagen lige bagud — som om du laver en "dobbelthage". Hold 5 sekunder og slip. Retter en fremskudt hovedstilling og aktiverer de dybe nakkemuskler, som aflaster de stramme øvre trapezmuskler.',
        label: '10 reps',
        type: 'reps',
      },
      {
        id: 'add-nakke-3',
        name: 'Øvre trapez-stræk med bænk',
        desc: 'Sid på en bænk og hold fast i kanten med den ene hånd. Læn nakken til den modsatte side og brug den fri hånd til at trække hovedet let videre. Direkte stræk i øvre trapez, der spænder under stangbæring og tunge løft.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-nakke-4',
        name: 'Halve nakke-cirkler',
        desc: 'Lad hagen falde mod brystet og rul langsomt hovedet til den ene skulder, videre bagover og til den anden skulder — undgå hele runder med kold nakke. Hold det roligt og kontrolleret. Løsner nakken og øvre trapez.',
        label: '5 reps pr. retning',
        type: 'reps',
      },
    ],
  },
};

const MOBILITY_AREAS = [
  { id: 'ankel', label: 'Ankel-bevægelighed' },
  { id: 'hofte', label: 'Hofteåbning' },
  { id: 'hoftefleksor', label: 'Hoftebøjere' },
  { id: 'baller', label: 'Balleaktivering' },
  { id: 'tryg', label: 'Brystryg' },
  { id: 'skulder', label: 'Skulder / lat' },
  { id: 'lyske', label: 'Lyske / inderlår' },
  { id: 'laend', label: 'Lænde-aflastning' },
]

const MOBILITY_LIBRARY = {
  ankel: [
    { id: 'mob-ankel-1', name: 'Ankel-vægstræk', desc: 'Stå med tåen ca. 10 cm fra en væg og pres knæet fremad, til det rører væggen — hælen skal blive i gulvet. Flyt tåen længere væk, når det bliver let. Det vigtigste for squat-dybde er, at anklen kan bøje nok til at knæet kan vandre frem over tæerne — så kan du sidde lavt med oprejst overkrop.', label: '8 reps pr. side', type: 'reps' },
    { id: 'mob-ankel-2', name: 'Knælende lægstræk', desc: 'Sæt det ene knæ i gulvet og den anden fod fladt foran dig. Skub knæet ud over tæerne og hold, mens du presser hælen ned. Strækker læggen og akillessenen — hold roligt og træk vejret ind i strækket.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-ankel-3', name: 'Ankel-glid med elastik', desc: 'Bind et elastik fast i lav højde og læg løkken om anklen forfra, så det trækker anklen bagud. Pres knæet frem over tæerne i rolige, gentagne glid. Elastikken giver leddet plads og løsner anklen mere end et stræk alene.', label: '12 reps pr. side', type: 'reps' },
    { id: 'mob-ankel-4', name: 'Lægstræk på trappekant', desc: 'Stil forfoden på kanten af et trin og lad hælen synke ned under trinnet med strakt knæ. Hold roligt og skift ben. Strækker læggen i fuld længde — en stram læg begrænser hvor langt knæet kan vandre frem, og dermed hvor dybt du kan sidde.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-ankel-5', name: 'Ankel-cirkler', desc: 'Løft den ene fod og tegn store, langsomme cirkler i luften med tæerne — begge veje. Smører ankelleddet hele vejen rundt og er en nem måde at vække anklerne på, før de skal arbejde i bunden af et løft.', label: '10 cirkler pr. vej', type: 'reps' },
  ],
  hofte: [
    { id: 'mob-hofte-1', name: '90/90 hofterotation', desc: 'Sid på gulvet med det ene ben bøjet foran dig (90°) og det andet ud til siden (90°). Skub forsigtigt hoften frem mod det forreste ben, hold, og skift side. Rammer både udad- og indadrotation i hoften — afgørende for at komme dybt i squat uden at lænden runder.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hofte-2', name: 'Dyb squat-hold', desc: 'Sæt dig ned i bunden af en squat med fødderne fladt, og hold dig nede ved at skubbe knæene ud med albuerne. Flyt vægten lidt rundt og find de stramme punkter. Lærer hofte, ankel og lænd at falde til ro i den dybe position.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-hofte-3', name: 'Due-stræk', desc: 'Fra alle fire, før det ene knæ frem og læg skinnebenet skråt foran dig. Sænk hofterne og læn overkroppen frem med rank ryg. Dybt stræk af den dybe ballemuskel og bagsiden af hoften — det område der ofte spænder og blokerer dybden.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hofte-4', name: 'Hofte-cirkler på alle fire', desc: 'Stå på alle fire og løft det ene knæ ud til siden, før det i en stor cirkel frem og tilbage uden at vride i ryggen. Aktiv, kontrolleret bevægelse helt ud i hoftens yderpositioner — bygger bevægelighed du faktisk kan bruge under stangen.', label: '8 cirkler pr. side', type: 'reps' },
    { id: 'mob-hofte-5', name: 'Dybt squat-hold med rotation', desc: 'Sid i bunden af en dyb squat med fødderne fladt, og drej skiftevis det ene knæ ind mod gulvet. Kombinerer den dybe position med rotation i hoften, så du både åbner og styrer leddet dér hvor squatten er sværest.', label: '6 reps pr. side', type: 'reps' },
  ],
  hoftefleksor: [
    { id: 'mob-hfx-1', name: 'Hoftebøjer-stræk mod væg', desc: 'Knæl foran en væg og sæt det bageste skinneben lodret op ad væggen, så hælen peger op. Sæt den anden fod fladt foran dig i et stort skridt. Klem ballen på det bageste ben og skub hoften frem med rank ryg, til du mærker stræk foran i hoften og låret. Den mest direkte modgift mod stillesidning, hvor hoftebøjerne bliver korte og trækker bækkenet i svaj.', label: '45 sek pr. side', type: 'timer', duration: 45 },
    { id: 'mob-hfx-2', name: 'Knælende hoftebøjer-stræk', desc: 'Knæl på det ene knæ med den anden fod fladt foran dig. Klem ballen på det knælende ben og skub hoften langsomt frem, til du mærker stræk foran i hoften. Undgå at svaje i lænden — bevægelsen skal komme fra hoften, ikke fra ryggen.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hfx-3', name: 'Udfald med rotation', desc: 'Tag et stort skridt frem til et udfald, sæt hånden i gulvet inden for den forreste fod, og drej den anden arm op mod loftet med blikket efter hånden. Åbner hoftebøjer, lyske og brystryg i én bevægelse — en effektiv reset for hele kroppen efter en dag på stolen.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-hfx-4', name: 'Stående hoftebøjer-stræk', desc: 'Stå i et stort skridt, bøj det forreste knæ og klem ballen på det bageste ben, mens du skubber hoften frem. Samme stræk som den knælende, men stående — nemt at tage hvor som helst, fx i en pause fra skrivebordet.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hfx-5', name: 'Edderkop-udfald med rok', desc: 'Tag et stort skridt frem til et dybt udfald og sæt begge hænder i gulvet inden for foden. Rok blødt frem og tilbage i positionen. Åbner hoftebøjer og lyske på én gang og gør stive hofter klar til at arbejde.', label: '6 reps pr. side', type: 'reps' },
  ],
  baller: [
    { id: 'mob-baller-1', name: 'Hofteløft med pause', desc: 'Lig på ryggen med bøjede knæ. Skub hofterne op og klem ballerne hårdt — hold 5 sekunder i toppen og sænk roligt. Vækker de baller som stillesidning sætter i dvale, så de tager belastningen i stedet for lænden.', label: '10 reps', type: 'reps' },
    { id: 'mob-baller-2', name: 'Sidegang med elastik', desc: 'Læg et elastik om knæ eller ankler, gå i halv squat og tag kontrollerede skridt til siden uden at lade knæene falde ind. Aktiverer den mellemste ballemuskel — stabilisatoren der holder knæene ude under squat og dødløft.', label: '10 skridt pr. side', type: 'reps' },
    { id: 'mob-baller-3', name: 'Hofteløft på ét ben', desc: 'Lav et hofteløft med det ene ben strakt lige ud. Skub op gennem hælen på det bøjede ben og klem ballen i toppen. Afslører og retter forskelle i ballestyrke fra side til side, som ofte stammer fra at sidde skævt.', label: '8 reps pr. side', type: 'reps' },
    { id: 'mob-baller-4', name: 'Muslingen', desc: 'Lig på siden med bøjede knæ samlet og åbn det øverste knæ opad uden at vippe bækkenet bagud — gerne med et elastik om knæene. Vækker den mellemste ballemuskel, der holder knæet ude og bækkenet stabilt under squat og dødløft.', label: '12 reps pr. side', type: 'reps' },
    { id: 'mob-baller-5', name: 'Diagonalløft på alle fire', desc: 'Stå på alle fire og stræk modsat arm og ben ud i en lige linje, hold et øjeblik, og skift side. Træner balle og dybe rygmuskler til at holde kroppen stiv — netop den kontrol du bruger til at holde ryggen neutral i dødløft.', label: '8 reps pr. side', type: 'reps' },
  ],
  tryg: [
    { id: 'mob-tryg-1', name: 'Brystryg over skumrulle', desc: 'Læg en skumrulle på tværs under den øverste del af brystryggen, støt nakken med hænderne og bøj forsigtigt bagover hen over rullen. Flyt rullen lidt op og ned. Genvinder den bagoverbøjning som foroverbøjet siddning tager fra dig — en direkte forudsætning for en stabil bænk-bue.', label: '8 reps', type: 'reps' },
    { id: 'mob-tryg-2', name: 'Bogåbning', desc: 'Lig på siden med knæene bøjet op og armene strakt ud foran dig. Åbn den øverste arm i en stor bue over til den anden side og følg hånden med blikket, mens knæene bliver i gulvet. Genskaber rotation i brystryggen og åbner brystet efter mange timer foroverbøjet.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-tryg-3', name: 'Katte-kamel', desc: 'På alle fire, skift langsomt mellem at runde ryggen op mod loftet (kat) og synke ned i et svaj (kamel). Bevæg rygsøjlen led for led. Smører hele ryggen og bryder den krumme holdning en stol presser dig ind i.', label: '8 reps', type: 'reps' },
    { id: 'mob-tryg-4', name: 'Tråd nålen', desc: 'Stå på alle fire, før den ene arm ind under kroppen og drej overkroppen med, og åbn så samme arm op mod loftet og følg hånden med blikket. Genvinder rotationen i brystryggen, som en foroverbøjet kontordag gradvist stjæler.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-tryg-5', name: 'Væg-engle', desc: 'Stå med ryggen mod en væg og pres lænd, skuldre og håndrygge mod væggen. Glid armene langsomt op og ned som en sne-engel uden at miste kontakten. Lærer brystryggen at strække sig og skuldrene at arbejde frit — nyttigt for både bænk og løft over hovedet.', label: '8 reps', type: 'reps' },
  ],
  skulder: [
    { id: 'mob-skulder-1', name: 'Lat-stræk i dørkarm', desc: 'Tag fat om en dørkarm eller stang, sæt hoften bagud og lad overkroppen hænge, så siden af ryggen og skulderen strækkes. Stramme lats begrænser både armene over hovedet og en god bænk-bue — slip dem løs her.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-skulder-2', name: 'Skulder-rotation med pind', desc: 'Hold en pind eller et elastik med bredt greb og før den langsomt fra forsiden af hofterne op over hovedet og ned bag ryggen — kun så smalt som du kan med strakte arme. Åbner brystet og forbedrer skuldrenes bevægelighed lidt efter lidt.', label: '8 reps', type: 'reps' },
    { id: 'mob-skulder-3', name: 'Bryststræk i døråbning', desc: 'Stil dig i en døråbning og læg underarmen op ad karmen i en ret vinkel. Træd forsigtigt frem, til du mærker stræk over brystet. Modvirker de fremrullede skuldre fra tastatur og telefon — vigtigt for et sundt bænkpres.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-skulder-4', name: 'Passiv stanghæng', desc: 'Tag fat i en bom med strakt greb og lad kroppen hænge afslappet, så skuldrene strækkes ud. Aflaster og åbner skulderleddet og strækker hele siden af ryggen — en behagelig modvægt til timer med foroverbøjede skuldre.', label: '30 sek', type: 'timer', duration: 30 },
    { id: 'mob-skulder-5', name: 'Lat-stræk på bænk', desc: 'Knæl foran en bænk, læg albuerne på kanten og sænk brystet ned mod gulvet med strakte arme. Strækker siden af ryggen og brystryggen på én gang — godt for både armene over hovedet og en stabil bænk-bue.', label: '40 sek', type: 'timer', duration: 40 },
  ],
  lyske: [
    { id: 'mob-lyske-1', name: 'Frøstræk', desc: 'På alle fire, glid knæene bredt ud til siden med tæerne udad. Skub hoften langsomt bagud og ned, og lad inderlårene strække. Træk vejret dybt ind i det stramme område — bedre bevægelighed i inderlårene giver en bredere, mere stabil squat-stilling.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-lyske-2', name: 'Cossack-squat', desc: 'Stå bredt og skift vægten ned over det ene bøjede ben, mens det andet er strakt med tåen op. Skift roligt fra side til side. Dynamisk bevægelighed i inderlårene under let belastning — bygger styrke yderst i bevægelsen, ikke bare passivt stræk.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-lyske-3', name: 'Knælende inderlår-stræk', desc: 'På alle fire, stræk det ene ben ud til siden med foden fladt i gulvet. Gynge hoften langsomt bagud mod hælen og frem igen. Kontrolleret, gentaget stræk af inderlåret, der føles bedre end et langt passivt hold.', label: '10 reps pr. side', type: 'reps' },
    { id: 'mob-lyske-4', name: 'Sommerfugl-stræk', desc: 'Sid med fodsålerne mod hinanden og lad knæene synke mod gulvet, mens du sidder rank. Pres eventuelt blidt på knæene med albuerne. Roligt stræk af inderlårene, der giver mere plads til en bred squat-stilling.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-lyske-5', name: 'Bredbenet foroverbøjning', desc: 'Stå bredt med strakte ben og tæerne lidt udad, og fold langsomt forover med rank ryg, til du mærker stræk i inderlår og baglår. Hold og træk vejret ned i strækket. Åbner inderlårene i en stilling tæt på sumo-træk og bred squat.', label: '40 sek', type: 'timer', duration: 40 },
  ],
  laend: [
    { id: 'mob-laend-1', name: 'Knæ-til-bryst', desc: 'Lig på ryggen og træk begge knæ blødt op mod brystet. Gynge let fra side til side. Aflaster lænden og giver de små rygmuskler en pause efter en dag i sammenpresset stilling — rart, ikke et præstationsstræk.', label: '40 sek', type: 'timer', duration: 40 },
    { id: 'mob-laend-2', name: 'Liggende rygrotation', desc: 'Lig på ryggen og før det ene knæ over til den modsatte side, mens skuldrene bliver i gulvet og blikket går den anden vej. Blød rotation der løsner lænd og hofte på én gang. Hold og træk vejret roligt.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-laend-3', name: 'Barnets stilling', desc: 'Sæt dig tilbage på hælene med armene strakt frem og panden mod gulvet. Træk vejret ned i lænden og lad ryggen runde blødt. En enkel aflastning der afslutter rutinen og skifter kroppen over i ro.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-laend-4', name: 'Bækken-vip på ryggen', desc: 'Lig på ryggen med bøjede knæ og vip bækkenet blidt, så lænden skiftevis presses ned i gulvet og løftes til et lille svaj. Små, rolige bevægelser. Lærer dig at styre bækkenet og løsner en stiv lænd uden belastning.', label: '12 reps', type: 'reps' },
    { id: 'mob-laend-5', name: 'Vinduesviskere', desc: 'Lig på ryggen med bøjede knæ samlet og lad dem falde langsomt fra side til side som viskere, mens skuldrene bliver i gulvet. Blød rotation der løsner lænd og hofte og afslutter rutinen roligt.', label: '8 reps pr. side', type: 'reps' },
  ],
}

const MOBILITY_PROBLEM_MAP = {
  'Hofte / baller': ['hofte', 'baller'],
  'Lyske / inderlår': ['lyske'],
  'Lænde': ['hoftefleksor', 'laend'],
  'Øvre ryg': ['tryg'],
  'Ankel': ['ankel'],
  'Knæ': ['hofte', 'ankel'],
  'Skulder': ['skulder'],
  'Nakke / trapez': ['tryg', 'skulder'],
}

// Genererer en anbefalet rutine (ordnet liste af område-id'er) ud fra intake-svarene.
// Vægter områderne efter løft, stillesidning og problemzoner, vælger top-N (N styres af
// tilgængelig tid) og sorterer dem i en logisk rækkefølge (nedefra-og-op + afslut roligt).
function buildMobilityRoutine(intake) {
  const n = intake.time === 5 ? 4 : intake.time === 15 ? 8 : 6
  const score = {}
  for (const a of MOBILITY_AREAS) score[a.id] = 0.1 // svag baseline så alle kan vælges
  const bump = (id, w) => { if (id in score) score[id] += w }
  // Løft → relevante led
  const lifts = new Set(intake.lifts || [])
  if (lifts.has('squat')) { bump('ankel', 2); bump('hofte', 2); bump('lyske', 1) }
  if (lifts.has('bench')) { bump('tryg', 2); bump('skulder', 2) }
  if (lifts.has('deadlift')) { bump('hoftefleksor', 2); bump('baller', 1.5); bump('tryg', 1) }
  // Stillesidning → modvirk forkortede hoftefleksorer, stiv t-ryg, døde baller
  if (intake.sitting === 'high') { bump('hoftefleksor', 2); bump('tryg', 1.5); bump('baller', 1.5); bump('laend', 1) }
  else if (intake.sitting === 'med') { bump('hoftefleksor', 1); bump('tryg', 0.75); bump('baller', 0.75) }
  // Problemzoner vægter tungest (akut oplevet stivhed)
  for (const p of (intake.problems || [])) for (const id of (MOBILITY_PROBLEM_MAP[p] || [])) bump(id, 2.5)
  // Dagens readiness-ømhed (auto fra check-in) vægter også højt
  for (const id of (intake.soreAreas || [])) bump(id, 2)
  // Vælg top-N, behold den kanoniske MOBILITY_AREAS-rækkefølge for et roligt flow
  const ranked = [...MOBILITY_AREAS].map(a => a.id).sort((x, y) => score[y] - score[x])
  const chosen = new Set(ranked.slice(0, n))
  return MOBILITY_AREAS.map(a => a.id).filter(id => chosen.has(id))
}

// Hvilke hovedløft træner atleten i den aktuelle uge? Bruges til at forudvælge løft
// i mobilitets-intaken, så forslaget rammer det de faktisk laver (samme detektion
// som opvarmningen). Returnerer ['squat'|'bench'|'deadlift'].
function liftsFromWeek(week) {
  const found = new Set()
  for (const sess of week?.sessions || []) {
    for (const ex of sess.exercises || []) {
      // foldNavn() gør detektionen uafhængig af om øvelsen hedder "Bænkpres"
      // eller "Baenkpres" — begge stavemåder findes i basen (se exerciseNames.js).
      const n = foldNavn(ex.name)
      if (n.includes('squat')) found.add('squat')
      if (n.includes('baenk') || n.includes('bench')) found.add('bench')
      if (n.includes('doedl') || n.includes('deadlift') || n.includes('sumo')) found.add('deadlift')
    }
  }
  return [...found]
}

// Readiness-loggens grove ømhedszoner (Ben/Ryg/Skuldre/Core) → mobilitets-områder,
// så dagens selvrapporterede ømhed automatisk kan vægte forslaget.
const SORE_ZONE_TO_AREAS = {
  'Ben': ['hofte', 'lyske', 'ankel'],
  'Ryg': ['tryg', 'laend'],
  'Skuldre/Arme': ['skulder', 'tryg'],
  'Core': ['laend', 'hoftefleksor'],
}
function areasFromSoreZones(zones) {
  const out = new Set()
  for (const z of zones || []) for (const a of (SORE_ZONE_TO_AREAS[z] || [])) out.add(a)
  return [...out]
}

// Byg de konkrete øvelses-slots ud fra intaken: anbefalede områder + en TILFÆLDIG
// øvelse pr. område (frisk session hver gang, udnytter de 5 øvelser pr. område).
function slotsFromIntake(intake) {
  return buildMobilityRoutine(intake).map(area => {
    const count = (MOBILITY_LIBRARY[area] || []).length
    return { area, choiceIdx: count > 1 ? Math.floor(Math.random() * count) : 0 }
  })
}


function MobilityGuideStep({ heading, step, total, onExit, areaLabel, ex, opts, choiceIdx, onChoose, timerSeconds, timerActive, timerDone, setTimerSeconds, setTimerActive, setTimerDone, onPrev, onNext, isLast }) {
  const hasChoices = opts.length > 1
  const pct = Math.round((step / total) * 100)
  return (
    <>
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.08em' }}>{heading} · Øvelse {step + 1} af {total}</div>
          <button style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }} onClick={onExit}>✕ Afslut</button>
        </div>
        <div style={{ height: '2px', background: 'rgba(237,234,226,0.07)', borderRadius: '1px' }}>
          <div style={{ height: '100%', background: '#c8923a', width: `${pct}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>
      {hasChoices && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Vælg øvelse · {areaLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {opts.map((opt, i) => <button key={opt.id} onClick={() => onChoose(i)} style={{ background: i === choiceIdx ? 'rgba(200,146,58,0.15)' : '#1c1c18', border: `1px solid ${i === choiceIdx ? '#c8923a' : 'rgba(237,234,226,0.1)'}`, color: i === choiceIdx ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, padding: '0.45rem 0.7rem', cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}>{opt.name}</button>)}
          </div>
        </div>
      )}
      <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.75rem', marginBottom: '1.25rem', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '1rem', lineHeight: 1.2 }}>{ex.name}</h2>
          {ex.desc && <p style={{ fontSize: '0.9rem', color: '#b8b4a8', lineHeight: 1.75, margin: 0 }}>{ex.desc}</p>}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          {ex.type === 'timer' ? (
            <div>
              <div style={{ marginBottom: '0.85rem' }}>
                <CountdownRing total={ex.duration} remaining={timerSeconds > 0 ? timerSeconds : ex.duration} done={timerDone} />
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{ex.label}</div>
              {!timerDone ? (
                <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { if (!timerActive && timerSeconds === 0) setTimerSeconds(ex.duration); setTimerActive(a => !a) }}>
                  {timerActive ? '⏸ Pause' : (timerSeconds > 0 && timerSeconds < ex.duration) ? '▶ Fortsæt' : '▶ Start timer'}
                </button>
              ) : (
                <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { setTimerSeconds(ex.duration); setTimerDone(false); setTimerActive(false) }}>↺ Gentag (anden side)</button>
              )}
            </div>
          ) : (
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#c8923a' }}>{ex.label}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        {onPrev && <button style={{ ...s.btnGhost, padding: '0.75rem 1rem' }} onClick={onPrev}>←</button>}
        <button style={{ ...s.btnPrimary, flex: 1, padding: '0.85rem', fontSize: '0.62rem' }} onClick={onNext}>{isLast ? 'Afslut ✓' : 'Næste øvelse →'}</button>
      </div>
    </>
  )
}

export default function MobiliseringTab({
  currentWeek, mobilityIntake, mobilityMode, mobilityPhase, mobilitySlots, mobilityStep,
  readinessLog, setMobilityIntake, setMobilityMode, setMobilityPhase, setMobilitySlots,
  setMobilityStep, setTimerActive, setTimerDone, setTimerSeconds, setWarmupChoice,
  setWarmupExercises, setWarmupFocus, setWarmupPhase, setWarmupProblems, setWarmupStep,
  setWarmupSubtype, timerActive, timerDone, timerSeconds, warmupChoice, warmupExercises,
  warmupFocus, warmupPhase, warmupProblems, warmupStep, warmupSubtype, warmupTemplates,
}) {
  return (
    <>
        {mobilityMode === null && (() => {
          const Door = ({ icon, title, sub, subColor, onClick }) => (
            <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', padding: '1.1rem 1.25rem', cursor: 'pointer', textAlign: 'left', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, width: 28, textAlign: 'center' }}>{icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#edeae2', lineHeight: 1.2 }}>{title}</span>
                <span style={{ display: 'block', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.05em', color: subColor || '#7a7770', marginTop: '0.3rem' }}>{sub}</span>
              </span>
              <span style={{ color: '#4a4844', fontSize: '1.1rem', flexShrink: 0 }}>›</span>
            </button>
          )
          return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Mobilitet</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Hvad har du brug for?</h1>
              </div>
              <Door icon="⚡" title="Varm op" sub="Inden du løfter" onClick={() => setMobilityMode('opvarmning')} />
              <Door icon="✦" title="Mobilitet" sub="Byg en session — tag den når du er stram"
                onClick={() => {
                  // Land direkte på et forslag (løft fra ugens program + dagens ømhed) — ingen formular-port.
                  const intake = { time: 10, sitting: 'med', lifts: liftsFromWeek(currentWeek), problems: [], soreAreas: areasFromSoreZones(readinessLog?.sore_zones) }
                  setMobilityIntake(intake)
                  setMobilitySlots(slotsFromIntake(intake))
                  setMobilityStep(0); setMobilityPhase('design'); setMobilityMode('mobilitet')
                }} />
            </>
          )
        })()}

        {/* Tilbage til landing — vises over enhver valgt mode */}
        {mobilityMode && (
          <button onClick={() => setMobilityMode(null)} style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', padding: '0 0 1rem 0' }}>‹ Mobilitet</button>
        )}

        {/* OPVARMNING (hub-mode) */}
        {mobilityMode === 'opvarmning' && (() => {
          const FOCUSES = ['Squat', 'Bænkpres', 'Dødløft']
          const PROBLEMS = ['Hofte / baller', 'Lyske / inderlår', 'Lænde', 'Øvre ryg', 'Ankel', 'Knæ', 'Skulder', 'Nakke / trapez']
          const baseKey = warmupFocus === 'Dødløft' ? `Dødløft — ${warmupSubtype}` : warmupFocus
          const focusReady = warmupFocus && (warmupFocus !== 'Dødløft' || warmupSubtype)

          function startGuide() {
            // Hvert slot er { slot, options: [...] }. Atleten vælger én option pr.
            // slot i guiden (default = den første). Coach-trin bliver slots med ét valg.
            const base = WARMUP_BASE[baseKey] || []
            const coachFocusKey = warmupFocus === 'Dødløft' ? 'Dødløft' : warmupFocus
            const coachSteps = (warmupTemplates.find(t => t.exercise_category === coachFocusKey)?.steps || [])
              .map((step, i) => ({ slot: 'Fra din coach', options: [{ id: `coach_${i}`, name: step, desc: '', label: '', type: 'reps' }] }))
            const addons = [...warmupProblems].map(p => WARMUP_ADDONS[p]).filter(Boolean)
            const slots = [...base, ...addons, ...coachSteps]
            setWarmupExercises(slots)
            setWarmupChoice({})   // friskt valg hver gang → default option 0
            setWarmupStep(0)
            setTimerActive(false)
            setTimerSeconds(0)
            setTimerDone(false)
            setWarmupPhase('guide')
          }

          function goToStep(idx) {
            setWarmupStep(idx)
            setTimerActive(false)
            setTimerDone(false)
            const slot = warmupExercises[idx]
            const opt = slot?.options?.[warmupChoice[idx] ?? 0]
            setTimerSeconds(opt?.type === 'timer' ? opt.duration : 0)
          }

          function resetWarmup() {
            setWarmupPhase('focus')
            setWarmupFocus(null)
            setWarmupSubtype(null)
            setWarmupProblems(new Set())
            setWarmupExercises([])
            setWarmupChoice({})
            setWarmupStep(0)
            setTimerActive(false)
            setTimerSeconds(0)
            setTimerDone(false)
          }

          // FASE: FOKUS
          if (warmupPhase === 'focus') return (
            <>
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Opvarmning</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Hvad træner du i dag?</h1>
                {warmupFocus && !warmupSubtype && warmupFocus !== 'Dødløft' && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#c8923a', marginTop: '0.4rem', letterSpacing: '0.06em' }}>Auto-detekteret fra dit program</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {FOCUSES.map(f => (
                  <button key={f} onClick={() => { setWarmupFocus(f); if (f !== 'Dødløft') setWarmupSubtype(null) }} style={{
                    background: warmupFocus === f ? 'rgba(200,146,58,0.15)' : '#1c1c18',
                    border: `1px solid ${warmupFocus === f ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                    color: warmupFocus === f ? '#c8923a' : '#edeae2',
                    fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', fontWeight: 400,
                    padding: '1rem 1.25rem', cursor: 'pointer', textAlign: 'left',
                  }}>{f}</button>
                ))}
              </div>

              {warmupFocus === 'Dødløft' && (
                <div style={{ marginBottom: '1.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(200,146,58,0.3)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Variant</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['Konventionel', 'Sumo'].map(st => (
                      <button key={st} onClick={() => setWarmupSubtype(st)} style={{
                        flex: 1, background: warmupSubtype === st ? '#c8923a' : '#1c1c18',
                        border: `1px solid ${warmupSubtype === st ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                        color: warmupSubtype === st ? '#141410' : '#7a7770',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '0.65rem', cursor: 'pointer',
                      }}>{st}</button>
                    ))}
                  </div>
                </div>
              )}

              {focusReady && (
                <button style={{ ...s.btnPrimary, width: '100%', padding: '0.85rem', fontSize: '0.62rem' }}
                  onClick={() => setWarmupPhase('problems')}>
                  Næste →
                </button>
              )}
            </>
          )

          // FASE: PROBLEMER
          if (warmupPhase === 'problems') return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>{baseKey}</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Hvad er stramt eller tungt i dag?</h1>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.4rem' }}>Valgfrit — vælg op til 2 områder</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {PROBLEMS.map(p => {
                  const on = warmupProblems.has(p)
                  return (
                    <button key={p} onClick={() => setWarmupProblems(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : (n.size < 2 && n.add(p)); return n })} style={{
                      background: on ? 'rgba(200,146,58,0.15)' : '#1c1c18',
                      border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                      color: on ? '#c8923a' : '#7a7770',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '0.75rem 0.5rem', cursor: 'pointer', textAlign: 'center',
                    }}>{p}</button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button style={{ ...s.btnGhost, flex: 1, padding: '0.75rem' }} onClick={() => setWarmupPhase('focus')}>← Tilbage</button>
                <button style={{ ...s.btnPrimary, flex: 2, padding: '0.75rem', fontSize: '0.62rem' }} onClick={startGuide}>
                  Start opvarmning ({(WARMUP_BASE[baseKey]?.length || 0) + warmupProblems.size} øvelser)
                </button>
              </div>
            </>
          )

          // FASE: GUIDE
          if (warmupPhase === 'guide') {
            const slot = warmupExercises[warmupStep]
            if (!slot) return null
            const choiceIdx = warmupChoice[warmupStep] ?? 0
            const ex = slot.options[choiceIdx] || slot.options[0]
            const hasChoices = slot.options.length > 1
            const isLast = warmupStep === warmupExercises.length - 1
            const pct = Math.round(((warmupStep) / warmupExercises.length) * 100)

            // Skift variant inden for slottet — nulstil timeren (ny varighed kan gælde)
            const chooseVariant = (i) => {
              setWarmupChoice(c => ({ ...c, [warmupStep]: i }))
              setTimerActive(false)
              setTimerDone(false)
              const opt = slot.options[i]
              setTimerSeconds(opt?.type === 'timer' ? opt.duration : 0)
            }

            if (!ex) return null

            return (
              <>
                {/* Progress */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.08em' }}>
                      {warmupFocus} · Øvelse {warmupStep + 1} af {warmupExercises.length}
                    </div>
                    <button style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem' }} onClick={resetWarmup}>✕ Afslut</button>
                  </div>
                  <div style={{ height: '2px', background: 'rgba(237,234,226,0.07)', borderRadius: '1px' }}>
                    <div style={{ height: '100%', background: '#c8923a', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* Variant-vælger — kun når slottet har flere øvelser at vælge imellem */}
                {hasChoices && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>
                      Vælg øvelse · {slot.slot}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {slot.options.map((opt, i) => {
                        const on = i === choiceIdx
                        return (
                          <button
                            key={opt.id}
                            onClick={() => chooseVariant(i)}
                            style={{
                              background: on ? 'rgba(200,146,58,0.15)' : '#1c1c18',
                              border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                              color: on ? '#c8923a' : '#7a7770',
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500,
                              letterSpacing: '0.03em', padding: '0.45rem 0.7rem', cursor: 'pointer',
                              textAlign: 'left', lineHeight: 1.3,
                            }}
                          >{opt.name}</button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Exercise card */}
                <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.75rem', marginBottom: '1.25rem', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '1rem', lineHeight: 1.2 }}>{ex.name}</h2>
                    {ex.desc && <p style={{ fontSize: '0.9rem', color: '#b8b4a8', lineHeight: 1.75, margin: 0 }}>{ex.desc}</p>}
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    {ex.type === 'timer' ? (
                      <div>
                        <div style={{ marginBottom: '0.85rem' }}>
                          <CountdownRing total={ex.duration} remaining={timerSeconds > 0 ? timerSeconds : ex.duration} done={timerDone} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{ex.label}</div>
                        {!timerDone ? (
                          <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => {
                            if (!timerActive && timerSeconds === 0) setTimerSeconds(ex.duration)
                            setTimerActive(a => !a)
                          }}>
                            {timerActive ? '⏸ Pause' : timerSeconds > 0 ? '▶ Fortsæt' : '▶ Start timer'}
                          </button>
                        ) : (
                          <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { setTimerSeconds(ex.duration); setTimerDone(false); setTimerActive(false) }}>
                            ↺ Gentag (anden side)
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#c8923a' }}>{ex.label}</div>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  {warmupStep > 0 && (
                    <button style={{ ...s.btnGhost, padding: '0.75rem 1rem' }} onClick={() => goToStep(warmupStep - 1)}>←</button>
                  )}
                  <button
                    style={{ ...s.btnPrimary, flex: 1, padding: '0.85rem', fontSize: '0.62rem' }}
                    onClick={() => isLast ? setWarmupPhase('done') : goToStep(warmupStep + 1)}
                  >
                    {isLast ? 'Afslut opvarmning ✓' : 'Næste øvelse →'}
                  </button>
                </div>
              </>
            )
          }

          // FASE: DONE
          return (
            <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', color: '#6cba6c', marginBottom: '1rem' }}>✓</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.5rem' }}>Opvarmning færdig.</h2>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.08em', marginBottom: '2rem' }}>
                {warmupExercises.length} øvelser gennemført
              </div>
              <button style={{ ...s.btnGhost, padding: '0.75rem 1.5rem' }} onClick={resetWarmup}>Start forfra</button>
            </div>
          )
        })()}

        {/* DAGLIG MOBILISERING (hub-mode) */}
        {mobilityMode === 'mobilitet' && (() => {
          const areaLabel = id => MOBILITY_AREAS.find(a => a.id === id)?.label || id
          const exForSlot = slot => { const opts = MOBILITY_LIBRARY[slot.area] || []; return opts[slot.choiceIdx ?? 0] || opts[0] }
          const estMin = mobilitySlots.length <= 4 ? 5 : mobilitySlots.length <= 6 ? 10 : 15

          // Skift tid inline på forslaget → genbyg uden formular-port.
          function setSessionTime(t) {
            const intake = { ...mobilityIntake, time: t }
            setMobilityIntake(intake)
            setMobilitySlots(slotsFromIntake(intake))
          }
          // Byg et friskt forslag forfra (samme kilde som døren: løft fra ugens
          // program + dagens ømhed) og land på design.
          function rebuildSuggestion() {
            const intake = { time: 10, sitting: 'med', lifts: liftsFromWeek(currentWeek), problems: [], soreAreas: areasFromSoreZones(readinessLog?.sore_zones) }
            setMobilityIntake(intake)
            setMobilitySlots(slotsFromIntake(intake))
            setMobilityStep(0); setMobilityPhase('design')
          }
          function startGuide() {
            setMobilityStep(0); setTimerActive(false); setTimerSeconds(0); setTimerDone(false); setMobilityPhase('guide')
          }
          function goStep(idx) {
            setMobilityStep(idx); setTimerActive(false); setTimerDone(false)
            const ex = exForSlot(mobilitySlots[idx]); setTimerSeconds(ex?.type === 'timer' ? ex.duration : 0)
          }

          // ───── DESIGN: finjustér rutinen ─────
          if (mobilityPhase === 'design') {
            const usedAreas = new Set(mobilitySlots.map(sl => sl.area))
            const available = MOBILITY_AREAS.filter(a => !usedAreas.has(a.id))
            const setChoice = (idx, ci) => setMobilitySlots(prev => prev.map((sl, i) => i === idx ? { ...sl, choiceIdx: ci } : sl))
            const removeSlot = idx => setMobilitySlots(prev => prev.filter((_, i) => i !== idx))
            const addArea = id => setMobilitySlots(prev => [...prev, { area: id, choiceIdx: 0 }])
            return (
              <>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Din session · {mobilitySlots.length} øvelser · ~{estMin} min</div>
                  <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Din session</h1>
                  <div style={{ fontSize: '0.82rem', color: '#7a7770', marginTop: '0.5rem', lineHeight: 1.6 }}>Skift øvelser, fjern dem du ikke vil have, eller tilføj flere. Start når du er klar.</div>
                  {mobilityIntake.soreAreas?.length > 0 && readinessLog?.sore_zones?.length > 0 && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.04em', marginTop: '0.6rem' }}>✓ Tilpasset efter dagens ømhed: {readinessLog.sore_zones.join(', ')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  {[5, 10, 15].map(t => {
                    const on = mobilityIntake.time === t
                    return <button key={t} onClick={() => setSessionTime(t)} style={{ flex: 1, background: on ? 'rgba(200,146,58,0.15)' : '#1c1c18', border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`, color: on ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.06em', padding: '0.55rem', cursor: 'pointer' }}>{t} min</button>
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {mobilitySlots.map((sl, idx) => {
                    const opts = MOBILITY_LIBRARY[sl.area] || []
                    const ex = exForSlot(sl)
                    return (
                      <div key={idx} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a' }}>{areaLabel(sl.area)}</span>
                          <button onClick={() => removeSlot(idx)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}>✕ fjern</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          {opts.map((opt, ci) => {
                            const on = (sl.choiceIdx ?? 0) === ci
                            return <button key={opt.id} onClick={() => setChoice(idx, ci)} style={{ background: on ? 'rgba(200,146,58,0.15)' : '#141410', border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`, color: on ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', padding: '0.4rem 0.6rem', cursor: 'pointer' }}>{opt.name}</button>
                          })}
                        </div>
                        {ex && <div style={{ fontSize: '0.78rem', color: '#7a7770', lineHeight: 1.5 }}>{ex.label}</div>}
                      </div>
                    )
                  })}
                </div>
                {available.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Tilføj område</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {available.map(a => <button key={a.id} onClick={() => addArea(a.id)} style={{ background: '#1c1c18', border: '1px dashed rgba(237,234,226,0.18)', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', padding: '0.45rem 0.7rem', cursor: 'pointer' }}>+ {a.label}</button>)}
                    </div>
                  </div>
                )}
                <button style={{ ...s.btnPrimary, width: '100%', padding: '0.85rem', fontSize: '0.62rem', opacity: mobilitySlots.length ? 1 : 0.5 }} disabled={!mobilitySlots.length} onClick={startGuide}>Start →</button>
              </>
            )
          }

          // ───── GUIDE: trin-for-trin (delt komponent) ─────
          if (mobilityPhase === 'guide') {
            const slot = mobilitySlots[mobilityStep]
            if (!slot) return null
            const ex = exForSlot(slot)
            if (!ex) return null
            const opts = MOBILITY_LIBRARY[slot.area] || []
            const isLast = mobilityStep === mobilitySlots.length - 1
            return (
              <MobilityGuideStep
                heading="Mobilitet" step={mobilityStep} total={mobilitySlots.length}
                onExit={() => setMobilityPhase('design')}
                areaLabel={areaLabel(slot.area)} ex={ex} opts={opts} choiceIdx={slot.choiceIdx ?? 0}
                onChoose={ci => { setMobilitySlots(prev => prev.map((sl, i) => i === mobilityStep ? { ...sl, choiceIdx: ci } : sl)); setTimerActive(false); setTimerDone(false); const o = opts[ci]; setTimerSeconds(o?.type === 'timer' ? o.duration : 0) }}
                timerSeconds={timerSeconds} timerActive={timerActive} timerDone={timerDone}
                setTimerSeconds={setTimerSeconds} setTimerActive={setTimerActive} setTimerDone={setTimerDone}
                onPrev={mobilityStep > 0 ? () => goStep(mobilityStep - 1) : null}
                onNext={() => { if (isLast) setMobilityPhase('done'); else goStep(mobilityStep + 1) }}
                isLast={isLast}
              />
            )
          }

          // ───── DONE ─────
          if (mobilityPhase === 'done') {
            return (
              <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', color: '#6cba6c', marginBottom: '1rem' }}>✓</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.5rem' }}>Mobilitet færdig.</h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.08em', marginBottom: '2rem' }}>{mobilitySlots.length} øvelser gennemført</div>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                  <button style={{ ...s.btnGhost, padding: '0.75rem 1.25rem' }} onClick={rebuildSuggestion}>Byg en ny</button>
                  <button style={{ ...s.btnPrimary, padding: '0.75rem 1.25rem' }} onClick={() => setMobilityMode(null)}>Til mobilitet</button>
                </div>
              </div>
            )
          }
          return null
        })()}
    </>
  )
}
