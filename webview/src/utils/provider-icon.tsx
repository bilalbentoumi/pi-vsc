import { LuSparkles } from 'react-icons/lu';
import { getProviderIconSvg } from '../libs/provider-icons';

export function ProviderIcon({
  provider,
  model,
}: {
  provider?: string;
  model?: string;
}) {
  const svg = getProviderIconSvg(provider, model);
  if (svg) {
    return (
      <span
        className="topbar-provider-icon"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <span className="topbar-provider-icon">
      <LuSparkles size={12} />
    </span>
  );
}
