import React from "react";

export default function VoteBar({ forVotes = 0, againstVotes = 0 }) {
  const yes = Number(forVotes);
  const no = Number(againstVotes);
  const total = yes + no;
  const yesWidth = total ? (yes / total) * 100 : 0;
  return <div className="vote-bar-wrap" aria-label={`For ${yes}, against ${no}`}>
    <div className="vote-bar"><span style={{ width: `${yesWidth}%` }} /></div>
    <div className="vote-bar-labels"><span>For: {yes.toLocaleString()} DCE</span><span>Against: {no.toLocaleString()} DCE</span></div>
  </div>;
}
