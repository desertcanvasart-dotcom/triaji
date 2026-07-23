/**
 * Triajji Widget Entry Point
 *
 * This runs immediately when the <script> is loaded on a host page.
 * It reads window.TriajjiConfig, fetches tenant config, and mounts
 * the widget inside a Shadow DOM for complete style isolation.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { TriajjiWidget } from './widget';
import { trackEvent } from './analytics';
import type { TenantConfig, UserConfig } from './config';
import { getApiUrl } from './config';

// Import CSS as string (Vite inlines this with ?inline)
import widgetCSS from './styles/widget.css?inline';

declare global {
  interface Window {
    TriajjiConfig?: {
      tenantSlug?: string;
      primaryColor?: string;
      position?: 'bottom-right' | 'bottom-left';
      buttonLabel?: string;
      apiUrl?: string;
    };
  }
}

(async function initTriajji() {
  const config = window.TriajjiConfig;

  if (!config?.tenantSlug) {
    console.warn('[Triajji] window.TriajjiConfig.tenantSlug is required');
    return;
  }

  const userConfig: UserConfig = {
    tenantSlug: config.tenantSlug,
    primaryColor: config.primaryColor,
    position: config.position,
    buttonLabel: config.buttonLabel,
    apiUrl: config.apiUrl,
  };

  const apiUrl = getApiUrl(userConfig);

  // Fetch validated tenant config from Triajji API
  let tenantConfig: TenantConfig;

  try {
    const response = await fetch(
      `${apiUrl}/api/embed/config?tenant=${encodeURIComponent(config.tenantSlug)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 403) {
        console.warn('[Triajji] Widget blocked: domain not authorised for this tenant');
      } else if (response.status === 404) {
        console.warn('[Triajji] Tenant not found:', config.tenantSlug);
      } else {
        console.warn('[Triajji] Failed to load widget config:', response.status);
      }
      return;
    }

    tenantConfig = await response.json();
  } catch (err) {
    console.warn('[Triajji] Network error loading widget config:', err);
    return;
  }

  // Track impression
  trackEvent(apiUrl, tenantConfig.tenantId, 'impression');

  // Mount widget in Shadow DOM
  mountWidget(tenantConfig, userConfig);
})();

function mountWidget(tenantConfig: TenantConfig, userConfig: UserConfig) {
  // Create host element
  const host = document.createElement('div');
  host.id = 'triaji-widget-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;top:0;left:0;width:0;height:0;';
  document.body.appendChild(host);

  // Attach shadow root
  const shadow = host.attachShadow({ mode: 'closed' });

  // Inject widget CSS into shadow root
  const style = document.createElement('style');
  style.textContent = widgetCSS;
  shadow.appendChild(style);

  // Create container for React
  const container = document.createElement('div');
  container.style.cssText = 'pointer-events:auto;';
  shadow.appendChild(container);

  // Mount React
  ReactDOM.createRoot(container).render(
    React.createElement(TriajjiWidget, { tenantConfig, userConfig })
  );
}
