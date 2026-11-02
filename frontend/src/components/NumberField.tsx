import React, { useEffect, useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';

type NumberFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number;
  onCommit: (value: number) => void;
};

/**
 * Числовое поле, в котором можно спокойно набирать «-12» или «1.5»:
 * промежуточный текст («-», «1.») хранится локально, а в стор уходит
 * только корректное число. Запятая принимается как десятичный разделитель.
 */
const NumberField: React.FC<NumberFieldProps> = ({ value, onCommit, onBlur, ...rest }) => {
  const [text, setText] = useState(String(value));

  // Значение изменилось извне (отмена, другое устройство) — показываем его
  useEffect(() => {
    setText((t) => (t.trim() !== '' && Number(t.replace(',', '.')) === value ? t : String(value)));
  }, [value]);

  return (
    <TextField
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t.replace(',', '.'));
        if (t.trim() !== '' && Number.isFinite(n)) onCommit(n);
      }}
      onBlur={(e) => {
        setText(String(value));
        onBlur?.(e);
      }}
    />
  );
};

export default NumberField;
