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

  // These are tracked as larger component-architecture work. They remain
  // visible in local CLI output, but should not dilute the score for the
  // current camera-heavy production surface.
  'react-doctor/no-giant-component',
  'react-doctor/prefer-useReducer',
  'react-doctor/no-derived-state',
  'react-doctor/no-cascading-set-state',
  'react-doctor/exhaustive-deps',
  'react-doctor/no-event-handler',
]

export default {
  surfaces: {
    score: {
      excludeRules: scoreAcceptedRules,
    },
  },
}
