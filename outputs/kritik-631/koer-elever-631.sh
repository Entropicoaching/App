# Kritik 631, blok 2: min elev (elev-631.mjs = elev-617.mjs + venner i snap og slut), 40 min paa elevens ur (20-minutters-tallene fra SNAP=1200), 390 touch.
#   m618 = matematik main edd01b5 (618 merget, 626 ikke), o626 = ordre-626 e5e0573 (626 blok 1, M15; ikke merget).
#   Elever: gaetter (GAET=1), svag aerlig (P1=0.4), dygtig (P1=0.9); hver koersel har baade travl og hjaelper.
#   bash outputs/kritik-631/koer-elever-631.sh a   (og b), logs i outputs/kritik-631/elev-631-*.log
cd "$(dirname "$0")"
k() { local navn=$1; shift; echo "== $navn $*"; env MINUTTER=40 BREDDER=390 "$@" node elev-631.mjs > "elev-631-$navn.log" 2>&1; echo "exit $? $navn"; }
if [ "$1" = a ]; then
  k m618-gaet-525 MAT_REF=edd01b5 TAG=m618 GAET=1 SEED=525 &
  k o626-gaet-525 MAT_REF=e5e0573 TAG=o626 GAET=1 SEED=525 &
  k m618-p04-525 MAT_REF=edd01b5 TAG=m618 P1=0.4 SEED=525 &
  k o626-p04-525 MAT_REF=e5e0573 TAG=o626 P1=0.4 SEED=525 &
  wait
elif [ "$1" = b ]; then
  k m618-p09-525 MAT_REF=edd01b5 TAG=m618 P1=0.9 SEED=525 &
  k o626-p09-525 MAT_REF=e5e0573 TAG=o626 P1=0.9 SEED=525 &
  k m618-gaet-731 MAT_REF=edd01b5 TAG=m618 GAET=1 SEED=731 &
  k o626-gaet-731 MAT_REF=e5e0573 TAG=o626 GAET=1 SEED=731 &
  wait
fi
