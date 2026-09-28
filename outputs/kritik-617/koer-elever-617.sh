# Kritik 617, blok 1: alle elev-koersler, 40 min paa elevens ur (20-minutters-tallene fra SNAP=1200).
#   main = 605 (4630a20), foer = c096c38 (602 merget, foer 605), o612 = ordre-612 (ikke merget).
#   bash outputs/kritik-617/koer-elever-617.sh a   (b, c og d), logs i outputs/kritik-617/elev-617-*.log
cd "$(dirname "$0")"
k() { local navn=$1; shift; echo "== $navn $*"; env MINUTTER=40 "$@" node elev-617.mjs > "elev-617-$navn.log" 2>&1; echo "exit $? $navn"; }
if [ "$1" = a ]; then
  k m605-525 MAT_REF=main TAG=m605 SEED=525 &
  k m605-731 MAT_REF=main TAG=m605 SEED=731 &
  k foer-525 MAT_REF=c096c38 TAG=foer SEED=525 &
  k foer-731 MAT_REF=c096c38 TAG=foer SEED=731 BREDDER=390 &
  wait
elif [ "$1" = b ]; then
  k m605-311 MAT_REF=main TAG=m605 SEED=311 BREDDER=390 &
  k foer-311 MAT_REF=c096c38 TAG=foer SEED=311 BREDDER=390 &
  k m605-p04-525 MAT_REF=main TAG=m605 P1=0.4 SEED=525 BREDDER=390 &
  k foer-p04-525 MAT_REF=c096c38 TAG=foer P1=0.4 SEED=525 BREDDER=390 &
  k m605-gaet-525 MAT_REF=main TAG=m605 GAET=1 SEED=525 BREDDER=390 &
  k foer-gaet-525 MAT_REF=c096c38 TAG=foer GAET=1 SEED=525 BREDDER=390 &
  wait
elif [ "$1" = c ]; then
  k o612-525 MAT_REF=ordre-612 TAG=o612 SEED=525 BREDDER=390 &
  k o612-p04-525 MAT_REF=ordre-612 TAG=o612 P1=0.4 SEED=525 BREDDER=390 &
  k o612-gaet-525 MAT_REF=ordre-612 TAG=o612 GAET=1 SEED=525 BREDDER=390 &
  k m605-red-731 MAT_REF=main TAG=m605 REDUKT=1 SEED=731 BREDDER=390 &
  wait
fi
# d: sidens eget "Rigtigt!" i foerste forsoeg (Ganitas 612, punkt 1 og 4), main = 612 merget (42e0ae2), 20 min.
if [ "$1" = d ]; then
  k m612-gaet-525 MINUTTER=20 MAT_REF=main TAG=m612 GAET=1 SEED=525 BREDDER=390 &
  k m612-gaet-731 MINUTTER=20 MAT_REF=main TAG=m612 GAET=1 SEED=731 BREDDER=390 &
  k m612-p04-525 MINUTTER=20 MAT_REF=main TAG=m612 P1=0.4 SEED=525 BREDDER=390 &
  wait
fi
