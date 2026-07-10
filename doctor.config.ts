const scoreAcceptedRules = [
  // Camera/video transports intentionally use ordered fallback attempts,
  // live <img> streams, and imperative media setup where generic React rules
  // would either duplicate sessions or add latency.
  'react-doctor/async-await-in-loop',
  'react-doctor/async-parallel',
  'react-doctor/no-fetch-in-effect',
  'react-doctor/nextjs-no-img-element',
  'react-doctor/iframe-missing-sandbox',

  // The compact bento tiles need wrapper-level click affordances while still
  // containing native links/buttons; replacing the wrapper with <button> would
  // create invalid nested interactive markup.
  'react-doctor/prefer-tag-over-role',
  'react-doctor/click-events-have-key-events',
  'react-doctor/no-static-element-interactions',

  // Ambient product/engineering motion is intentionally slower than normal UI
  // feedback; short loading/feedback animations were already reduced.
  'react-doctor/no-long-transition-duration',

  // `enabled` immediately gates the stream during render. The follow-up
  // effect only clears remembered user intent so closing a modal cannot
  // restart camera bandwidth without another explicit play action.
  'react-doctor/no-adjust-state-on-prop-change',

]

export default {
  surfaces: {
    score: {
      excludeRules: scoreAcceptedRules,
    },
  },
}
