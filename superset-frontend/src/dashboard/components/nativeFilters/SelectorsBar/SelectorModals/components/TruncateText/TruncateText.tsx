import React, { useEffect, useRef, useState } from 'react';

type PropsType = {
  text: string;
  maxWidth: number;
};

export const TruncateText = ({ text, maxWidth }: PropsType) => {
  const textRef = useRef(null);
  const [truncatedText, setTruncatedText] = useState(text);

  useEffect(() => {
    const truncate = () => {
      const element: any = textRef.current;
      if (!element) return;

      let truncated = text;

      while (element.scrollWidth > maxWidth && truncated.length > 0) {
        truncated = `...${truncated.slice(1)}`;
        setTruncatedText(truncated); // Обновляем состояние
      }
    };

    truncate();
  }, [text, maxWidth]);

  return (
    <div
      ref={textRef}
      style={{
        width: maxWidth,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        direction: 'rtl',
        textAlign: 'left',
      }}
    >
      {truncatedText}
    </div>
  );
};
