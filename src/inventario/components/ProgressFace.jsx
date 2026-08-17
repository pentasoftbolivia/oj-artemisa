const FaceBase = ({ children, title }) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 100 100"
    className="inline-block"
    {...(title ? { title } : {})}
  >
    <defs>
      <radialGradient id="faceGrad" cx="40%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#ffe3b3" />
        <stop offset="55%" stopColor="#f7b267" />
        <stop offset="100%" stopColor="#df8a3c" />
      </radialGradient>
      <filter id="faceShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="4"
          floodColor="#000"
          floodOpacity="0.35"
        />
      </filter>
    </defs>
    <g filter="url(#faceShadow)">
      <circle cx="50" cy="47" r="40" fill="url(#faceGrad)" />
      <circle
        cx="50"
        cy="47"
        r="40"
        fill="none"
        stroke="#c96f2e"
        strokeWidth="2"
      />
      <ellipse cx="50" cy="80" rx="34" ry="10" fill="#000" opacity="0.12" />
    </g>
    {children}
  </svg>
);

const LowFace = () => (
  <FaceBase title="No has llegado al 50%">
    <path
      d="M 20 32 L 43 42"
      stroke="#4a2c14"
      strokeWidth="7"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 80 32 L 57 42"
      stroke="#4a2c14"
      strokeWidth="7"
      strokeLinecap="round"
      fill="none"
    />
    <ellipse cx="33" cy="50" rx="7" ry="9" fill="#fff" />
    <circle cx="33" cy="51" r="4" fill="#2b1a0f" />
    <ellipse cx="67" cy="50" rx="7" ry="9" fill="#fff" />
    <circle cx="67" cy="51" r="4" fill="#2b1a0f" />
    <path d="M 34 70 Q 50 60 66 70 Q 50 75 34 70 Z" fill="#7c2d12" />
  </FaceBase>
);

const MidFace = () => (
  <FaceBase title="Has llegado al 50%">
    <path
      d="M 22 36 L 44 36"
      stroke="#4a2c14"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 56 36 L 78 36"
      stroke="#4a2c14"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <ellipse cx="33" cy="50" rx="7" ry="9" fill="#fff" />
    <circle cx="33" cy="51" r="4" fill="#2b1a0f" />
    <ellipse cx="67" cy="50" rx="7" ry="9" fill="#fff" />
    <circle cx="67" cy="51" r="4" fill="#2b1a0f" />
    <path d="M 34 72 L 66 72" stroke="#7c2d12" strokeWidth="6" strokeLinecap="round" fill="none" />
  </FaceBase>
);

const HighFace = () => (
  <FaceBase title="Has llegado al 80%">
    <path
      d="M 20 34 Q 30 28 40 33"
      stroke="#4a2c14"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 60 33 Q 70 28 80 34"
      stroke="#4a2c14"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 27 48 Q 33 43 39 48"
      stroke="#4a2c14"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 61 48 Q 67 43 73 48"
      stroke="#4a2c14"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    <ellipse cx="34" cy="62" rx="9" ry="5" fill="#f59e0b" opacity="0.4" />
    <ellipse cx="66" cy="62" rx="9" ry="5" fill="#f59e0b" opacity="0.4" />
    <path
      d="M 32 68 Q 50 88 68 68 Q 58 74 50 74 Q 42 74 32 68 Z"
      fill="#7c2d12"
    />
  </FaceBase>
);

const ProgressFace = ({ level }) => {
  if (level === "mid") return <MidFace />;
  if (level === "high") return <HighFace />;
  return <LowFace />;
};

export default ProgressFace;