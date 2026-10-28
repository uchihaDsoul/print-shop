import { useEffect, useState } from "react";
import { getRates } from "./api";

// Loads the public price list once, including which paper sizes are enabled
export default function useRates() {
  const [rates, setRates] = useState(null);

  useEffect(() => {
    getRates()
      .then(setRates)
      .catch(() => {});
  }, []);

  return rates;
}