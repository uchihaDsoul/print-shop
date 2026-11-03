// Embedded high-resolution icon data URL for Print Shop Agent companion window & system tray
const ICON_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABfUlEQVR4nO3XvVHEQAyG4asAyOiBlAoo4gqiGIqgHSLIICC4CFLw2F79fNIn30ozSvG+z+x5zOnU09OTNTcvHz/SZZ8VMprgqwJBhh8KIjK8NIT00Lf3D+I9BAQ62oNRKh4RbcGgx0eGSyGmiKchVIpPR9CGf31f4KuFoMUzAMIQrFeeARCCMDWA54XHAoAieN72TIA1hNT4CgBuhKkBEB86FQDMCFMDoD51qwIMEVDf+VUA1LdAC/D4dKZvA6AALNf/70HuXp//bRUAMYIHYBmfidAADdAAfIA1hIz4UgCsbYAGaIAGgABYEKwHsq7leen/DDXANQGMENi//xHAWs8ugPYWsOO1AMP4BjC+C7b27f3TvdZnm+MbAIjAAnDHrwFYEBgApjd/FEI2ADS+AQAImQAh8V6ELIDQ+D2EEUQ0wNaZ4PEehKhNj6+EQIsfIURD7D03LV6CgMSQPCc9XguhxZD+TWr4cqSHRiy7dXemDV/OtOFbM11wzwHmF/xlbyrynFzRAAAAAElFTkSuQmCC";

const ICON_DATA_URL = `data:image/png;base64,${ICON_BASE64}`;

function getNativeIcon(nativeImage) {
  try {
    return nativeImage.createFromDataURL(ICON_DATA_URL);
  } catch {
    return null;
  }
}

module.exports = {
  ICON_BASE64,
  ICON_DATA_URL,
  getNativeIcon,
};
