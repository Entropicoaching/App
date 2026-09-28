# Kritik 603, blok 2: alle elev-koersler (main = 596, ordre-602 = Ganitas M7, committet, ikke merget).
#   bash outputs/kritik-603/koer-elever-603.sh a   (og b), logs i outputs/kritik-603/elev-603-*.log
cd "$(dirname "$0")"
k() { local navn=$1; shift; echo "== $navn $*"; env "$@" node elev-603.mjs > "elev-603-$navn.log" 2>&1; echo "exit $? $navn"; }
if [ "$1" = a ]; then
  k m596-525 MAT_REF=main TAG=m596 SEED=525
  k o602-525 MAT_REF=ordre-602 TAG=o602 SEED=525
  k o602-gaet-525 MAT_REF=ordre-602 TAG=o602 GAET=1 SEED=525 BREDDER=390
  k m596-gaet-525 MAT_REF=main TAG=m596 GAET=1 SEED=525 BREDDER=390
else
  k o602-gaet-t3-731 MAT_REF=ordre-602 TAG=o602 GAET=1 TRYK_S=3 SEED=731 BREDDER=390
  k m596-gaet-t3-731 MAT_REF=main TAG=m596 GAET=1 TRYK_S=3 SEED=731 BREDDER=390
  k o602-p04-525 MAT_REF=ordre-602 TAG=o602 P1=0.4 SEED=525 BREDDER=390
  k m596-p04-525 MAT_REF=main TAG=m596 P1=0.4 SEED=525 BREDDER=390
  k o602-gaet-genindlaes-525 MAT_REF=ordre-602 TAG=o602 GAET=1 GENINDLAES=1 SEED=525 BREDDER=390
  k o602-red-731 MAT_REF=ordre-602 TAG=o602 REDUKT=1 SEED=731 BREDDER=390
fi
