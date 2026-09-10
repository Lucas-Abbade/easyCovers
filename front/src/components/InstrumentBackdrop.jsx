import React from 'react';

const InstrumentBackdrop = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 via-pink-50/30 to-indigo-50/30" style={{mixBlendMode: 'multiply'}}></div>

      {/* Instruments as real images from public/instruments/ with low opacity */}
      <img
        src="/instruments/guitar.png"
        alt="guitar"
        className="absolute -left-12 -top-12 w-64 h-64 object-contain opacity-10 filter blur-sm"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />

      <img
        src="/instruments/acoustic.png"
        alt="acoustic"
        className="absolute -right-10 -top-10 w-56 h-56 object-contain opacity-10 filter blur-sm"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />

      <img
        src="/instruments/drums.png"
        alt="drums"
        className="absolute -left-16 -bottom-12 w-72 h-72 object-contain opacity-8 filter blur-sm"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />

      <img
        src="/instruments/bass.png"
        alt="bass"
        className="absolute -right-16 -bottom-16 w-64 h-64 object-contain opacity-10 filter blur-sm"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />

      <img
        src="/instruments/mic.png"
        alt="microphone"
        className="absolute left-1/2 -top-6 transform -translate-x-1/2 w-36 h-36 object-contain opacity-12 filter blur-sm"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
};

export default InstrumentBackdrop;
