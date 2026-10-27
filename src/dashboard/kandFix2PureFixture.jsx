import { pureLabel } from './kandFix2PureValue.mjs'
export default function PureProbe({ select }) {
  return <button onClick={() => select(pureLabel('komponent'))}>{pureLabel('komponent')}</button>
}
