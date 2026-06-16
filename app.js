(function () {
  let content = window.SITE_CONTENT;
  const currentPage = document.body.dataset.page;
  const root = document.getElementById("page-root");
  const headerRoot = document.getElementById("site-header");
  const footerRoot = document.getElementById("site-footer");
  const LANGUAGES = Array.isArray(content.shared && content.shared.languages) ? content.shared.languages : [];
  const SUPPORTED_LANGS = new Set(LANGUAGES.map((item) => item.code));

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage failures in restricted file:// previews.
    }
  }

  function browserPreferredLang() {
    const languages = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
    for (const entry of languages) {
      const normalized = String(entry || "").toLowerCase().split("-")[0];
      if (SUPPORTED_LANGS.has(normalized)) {
        return normalized;
      }
    }
    return "en";
  }

  function urlLang() {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("lang");
    if (!candidate) {
      return "";
    }
    const normalized = String(candidate).toLowerCase();
    return SUPPORTED_LANGS.has(normalized) ? normalized : "";
  }

  function resolveInitialLang() {
    // 页面内联引导脚本已按相同优先级选定语言并加载了对应的 data/lang/ 文件;
    // 优先采用它,保证 currentLang 与已加载的内容文件一致。
    const boot = typeof window.__WMOI_LANG === "string" ? window.__WMOI_LANG : "";
    if (SUPPORTED_LANGS.has(boot)) {
      return boot;
    }

    const fromUrl = urlLang();
    if (fromUrl) {
      return fromUrl;
    }

    const fromStorage = safeStorageGet("wmoi-lang");
    if (SUPPORTED_LANGS.has(fromStorage)) {
      return fromStorage;
    }

    return browserPreferredLang();
  }

  function syncLangInUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", currentLang);
      window.history.replaceState({}, "", url.toString());
    } catch (_) {
      // Ignore URL rewrite failures in embedded file:// previews.
    }
  }

  let currentLang = resolveInitialLang();

  // 各语言内容文件缓存:切换语言时按需加载 data/lang/content.<lang>.js,已加载过的直接复用
  const LANG_CONTENT_VERSION = "20260613split";
  const langContentCache = {};
  langContentCache[currentLang] = content;

  function loadLangContent(lang, done) {
    if (langContentCache[lang]) {
      done(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `../data/lang/content.${lang}.js?v=${LANG_CONTENT_VERSION}`;
    script.onload = () => {
      langContentCache[lang] = window.SITE_CONTENT;
      done(true);
    };
    script.onerror = () => done(false);
    document.head.appendChild(script);
  }
  let langSwitchOutsideHandler = null;

  function interpolateText(value) {
    if (typeof value !== "string") {
      return value;
    }

    return value.replace(/\{\{\s*(email|wechat|siteUrl|brandShort|brandFull)\s*\}\}/g, (_, key) => {
      switch (key) {
        case "email":
          return content.site.email || "";
        case "wechat":
          return content.site.wechat || "";
        case "siteUrl":
          return (content.site.siteUrl || "").replace(/\/$/, "");
        case "brandShort":
          return content.site.brandShort || "";
        case "brandFull": {
          const brandFull = content.site.brandFull;
          if (typeof brandFull === "string") {
            return brandFull;
          }
          if (!brandFull || typeof brandFull !== "object") {
            return "";
          }
          return brandFull[currentLang] || brandFull.en || "";
        }
        default:
          return "";
      }
    });
  }

  function t(value) {
    if (typeof value === "string") {
      return interpolateText(value);
    }
    if (!value || typeof value !== "object") {
      return "";
    }
    return interpolateText(value[currentLang] || value.en || "");
  }

  function localizedTitleLead(value) {
    if (!value || typeof value !== "object") {
      return "";
    }
    const lead = value[`${currentLang}Lead`];
    return typeof lead === "string" ? interpolateText(lead) : "";
  }

  function localizedTitleLeadLines(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const lines = value[`${currentLang}LeadLines`];
    return Array.isArray(lines) ? lines.map((line) => interpolateText(line)) : null;
  }

  function localizedTitleLines(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const lines = value[`${currentLang}Lines`];
    return Array.isArray(lines) ? lines.map((line) => interpolateText(line)) : null;
  }

  function stackedLineMarkup(lines, lineClass) {
    if (!Array.isArray(lines) || !lines.length) {
      return "";
    }
    return lines.map((line) => `<span class="${lineClass}">${line}</span>`).join("");
  }

  function localizedBreakLineMarkup(value, lineClass) {
    const title = t(value);
    const lines = title
      .split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return title;
    }
    return stackedLineMarkup(lines, lineClass);
  }

  function homeHeroTitleMarkup(value) {
    const title = t(value);
    if (currentLang !== "zh") {
      return title;
    }

    const lead = localizedTitleLead(value);
    const leadLines = localizedTitleLeadLines(value);
    const lines = localizedTitleLines(value);
    if (!lead || !lines || !lines.length) {
      return title;
    }

    const leadMarkup = leadLines && leadLines.length
      ? `<span class="home-hero-title-latin home-hero-title-latin--structured">${leadLines
          .map(
            (line, index) => `<span class="home-hero-title-latin-line${index > 0 ? " home-hero-title-latin-line--secondary" : ""}">${line}</span>`
          )
          .join("")}</span>`
      : `<span class="home-hero-title-latin">${lead}</span>`;

    return `${leadMarkup}<span class="home-hero-title-cjk home-hero-title-cjk--structured">${lines.map(renderSpacedCjkLine).join("")}</span>`;
  }

  function homeShowcaseTitleMarkup(value) {
    const lines = localizedTitleLines(value);
    return lines && lines.length ? stackedLineMarkup(lines, "home-showcase-title-line") : t(value);
  }

  function trustHeroTitleMarkup(value) {
    const lines = localizedTitleLines(value);
    return lines && lines.length ? stackedLineMarkup(lines, "trust-hero-title-line") : t(value);
  }

  function aboutHeroTitleMarkup(value) {
    const lines = localizedTitleLines(value);
    return lines && lines.length ? stackedLineMarkup(lines, "page-hero-title-line") : t(value);
  }

  function renderSpacedCjkLine(text) {
    return `<span class="home-hero-title-line home-hero-title-line--spread">${Array.from(text)
      .map((char) => `<span class="home-hero-title-char">${char}</span>`)
      .join("")}</span>`;
  }

  function pageUrl(key) {
    const match = content.nav.find((item) => item.key === key);
    return match ? match.href : "./index.html";
  }

  function normalizePageBasePath(value) {
    const trimmed = String(value || "/").trim();
    if (!trimmed || trimmed === "/") {
      return "/";
    }
    return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
  }

  function rawHrefPath(href) {
    const match = String(href || "").match(/^[^?#]*/);
    return match ? match[0] : "";
  }

  function publicPagePath(pageKey) {
    const basePath = normalizePageBasePath(content.site.pageBasePath || "/");
    const relativePath = rawHrefPath(pageUrl(pageKey) || "./index.html").replace(/^\.\//, "");
    return new URL(relativePath || "index.html", `http://placeholder${basePath}`).pathname;
  }

  function withLang(href) {
    const resolvedHref = interpolateText(href);

    if (!resolvedHref || /^(mailto:|tel:|https?:|#)/.test(resolvedHref)) {
      return resolvedHref;
    }

    const url = new URL(resolvedHref, window.location.href);
    url.searchParams.set("lang", currentLang);
    return `${rawHrefPath(resolvedHref)}${url.search}${url.hash}`;
  }

  function absolutePageUrl(pageKey) {
    const base = interpolateText(content.site.siteUrl || "").replace(/\/$/, "");
    return `${base}${publicPagePath(pageKey)}?lang=${currentLang}`;
  }

  function defaultPageUrl(pageKey) {
    const base = interpolateText(content.site.siteUrl || "").replace(/\/$/, "");
    return `${base}${publicPagePath(pageKey)}`;
  }

  function siteAsset(key, fallback) {
    return interpolateText((content.site.assets && content.site.assets[key]) || fallback || "");
  }

  function absoluteAssetUrl(assetPath) {
    const resolvedPath = interpolateText(assetPath || "");
    if (!resolvedPath) {
      return "";
    }
    if (/^https?:\/\//.test(resolvedPath)) {
      return resolvedPath;
    }

    const base = interpolateText(content.site.siteUrl || "").replace(/\/$/, "");
    if (!base) {
      return resolvedPath;
    }

    return new URL(resolvedPath, `${base}/`).toString();
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function hexToRgb(value) {
    const normalized = String(value || "").trim().replace(/^#/, "");
    if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) {
      return null;
    }

    const full = normalized.length === 3
      ? normalized.split("").map((char) => `${char}${char}`).join("")
      : normalized;

    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    return `#${[rgb.r, rgb.g, rgb.b].map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  function rgbToCss(rgb) {
    return `${clampChannel(rgb.r)}, ${clampChannel(rgb.g)}, ${clampChannel(rgb.b)}`;
  }

  function mixRgb(from, to, ratio) {
    const weight = Math.max(0, Math.min(1, Number(ratio) || 0));
    return {
      r: from.r + (to.r - from.r) * weight,
      g: from.g + (to.g - from.g) * weight,
      b: from.b + (to.b - from.b) * weight
    };
  }

  function applyBrandTheme() {
    const themeRgb = hexToRgb(content.site.themeColor || "#4A3BB2");
    const backgroundRgb = hexToRgb(content.site.backgroundColor || "#f6f7fb");
    const accentPrimaryRgb = hexToRgb((content.site.accentColors && content.site.accentColors.primary) || "#67ADAE");
    const accentSecondaryRgb = hexToRgb((content.site.accentColors && content.site.accentColors.secondary) || "#CBDD6A");
    if (!themeRgb || !backgroundRgb || !accentPrimaryRgb || !accentSecondaryRgb) {
      return;
    }

    const darkBase = { r: 23, g: 26, b: 43 };
    const white = { r: 255, g: 255, b: 255 };
    const deep = mixRgb(themeRgb, darkBase, 0.76);
    const deepSoft = mixRgb(themeRgb, darkBase, 0.5);
    const light = mixRgb(themeRgb, white, 0.16);
    const mist = mixRgb(accentPrimaryRgb, backgroundRgb, 0.42);
    const pageSoft = mixRgb(backgroundRgb, white, 0.38);
    const pageDeep = mixRgb(backgroundRgb, darkBase, 0.08);

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--serif", (content.site.fonts && content.site.fonts.display) || "\"Baskerville\", \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif");
    rootStyle.setProperty("--sans", (content.site.fonts && content.site.fonts.body) || "\"SF Pro Display\", \"Avenir Next\", \"Helvetica Neue\", \"PingFang SC\", sans-serif");
    rootStyle.setProperty("--brand-rgb", rgbToCss(themeRgb));
    rootStyle.setProperty("--brand-soft-rgb", rgbToCss(mist));
    rootStyle.setProperty("--accent-a-rgb", rgbToCss(accentPrimaryRgb));
    rootStyle.setProperty("--accent-b-rgb", rgbToCss(accentSecondaryRgb));
    rootStyle.setProperty("--page-rgb", rgbToCss(backgroundRgb));
    rootStyle.setProperty("--page-soft-rgb", rgbToCss(pageSoft));
    rootStyle.setProperty("--page-deep-rgb", rgbToCss(pageDeep));
    rootStyle.setProperty("--forest-980", rgbToHex(deep));
    rootStyle.setProperty("--forest-940", rgbToHex(deepSoft));
    rootStyle.setProperty("--forest-900", rgbToHex(mixRgb(themeRgb, darkBase, 0.68)));
    rootStyle.setProperty("--forest-820", rgbToHex(light));
    rootStyle.setProperty("--gold-500", rgbToHex(themeRgb));
    rootStyle.setProperty("--gold-420", rgbToHex(accentPrimaryRgb));
    rootStyle.setProperty("--gold-260", rgbToHex(accentSecondaryRgb));
    rootStyle.setProperty("--cream-100", rgbToHex(backgroundRgb));
    rootStyle.setProperty("--cream-80", rgbToHex(pageSoft));
    rootStyle.setProperty("--cream-60", rgbToHex(white));
    rootStyle.setProperty("--line", `rgba(${rgbToCss(themeRgb)}, 0.12)`);
    rootStyle.setProperty("--line-strong", `rgba(${rgbToCss(themeRgb)}, 0.24)`);
  }

  function buttonLink(href, label, variant) {
    return `<a class="button ${variant || "button-primary"}" href="${withLang(href)}">${label}</a>`;
  }

  function isPendingDate(value) {
    return String(value || "").trim().toUpperCase() === "TBA";
  }

  function publicWechatValue() {
    const wechat = String(content.site.wechat || "").trim();
    return wechat && wechat !== "WMOI_Global" ? wechat : "";
  }

  function visibleContactChannels() {
    return content.shared.contactChannels.filter((channel) => {
      const value = String(t(channel.value) || "").trim();
      return value && value !== "WMOI_Global";
    });
  }

  function statValueMarkup(item) {
    const numericValue = Number(item.value);
    if (Number.isInteger(numericValue)) {
      return `<span class="metric-value" data-count="${numericValue}" data-suffix="${item.suffix || ""}">0${item.suffix || ""}</span>`;
    }
    return `<span class="metric-value">${item.value}${item.suffix || ""}</span>`;
  }

  function pageDescription() {
    const pageData = content.pages[currentPage];
    if (pageData && pageData.hero && pageData.hero.text) {
      return t(pageData.hero.text);
    }
    return t(content.shared.footerBlurb);
  }

  function pageTitle() {
    const contentTitles = content.site.seo && content.site.seo.pageTitles;
    return t((contentTitles && contentTitles[currentPage]) || (contentTitles && contentTitles.home));
  }

  function setMeta(selector, attribute, value) {
    const node = document.querySelector(selector);
    if (node && value) {
      node.setAttribute(attribute, value);
    }
  }

  function upsertJsonLd(key, payload) {
    const selector = `script[data-auto-head="jsonld"][data-jsonld-key="${key}"]`;
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("script");
      node.type = "application/ld+json";
      node.dataset.autoHead = "jsonld";
      node.dataset.jsonldKey = key;
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(payload);
  }

  function upsertAlternateLink(attrs) {
    const selectorParts = ['link[data-auto-head="alternate"]'];
    if (attrs.rel) {
      selectorParts.push(`[rel="${attrs.rel}"]`);
    }
    if (attrs.hreflang) {
      selectorParts.push(`[hreflang="${attrs.hreflang}"]`);
    }

    let node = document.head.querySelector(selectorParts.join(""));
    if (!node) {
      node = document.createElement("link");
      node.dataset.autoHead = "alternate";
      document.head.appendChild(node);
    }

    Object.entries(attrs).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
  }

  function updateAlternateMeta() {
    document.head.querySelectorAll('link[data-auto-head="alternate"]').forEach((node) => node.remove());

    LANGUAGES.forEach((language) => {
      upsertAlternateLink({
        rel: "alternate",
        hreflang: language.code,
        href: `${defaultPageUrl(currentPage)}?lang=${language.code}`
      });
    });

    upsertAlternateLink({
      rel: "alternate",
      hreflang: "x-default",
      href: defaultPageUrl(currentPage)
    });
  }

  function updateStructuredData() {
    const siteUrl = interpolateText(content.site.siteUrl || "").replace(/\/$/, "");
    const pageUrlValue = absolutePageUrl(currentPage);
    const brandName = t(content.site.brandFull) || content.site.brandShort || "WMOI";
    const logoUrl = absoluteAssetUrl(siteAsset("socialImage", "/assets/wmoi-mark.svg"));
    const languageCode = currentLang === "zh" ? "zh-CN" : currentLang;
    const description = pageDescription();

    const graph = [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: brandName,
        url: siteUrl,
        logo: logoUrl,
        email: content.site.email || undefined,
        areaServed: t(content.site.region) || undefined,
        contactPoint: content.site.email
          ? [
              {
                "@type": "ContactPoint",
                email: content.site.email,
                contactType: "competition inquiries",
                availableLanguage: LANGUAGES.map((item) => item.code),
                areaServed: t(content.site.region) || undefined
              }
            ]
          : undefined
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: brandName,
        publisher: { "@id": `${siteUrl}#organization` },
        inLanguage: LANGUAGES.map((item) => item.code)
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrlValue}#webpage`,
        url: pageUrlValue,
        name: pageTitle(),
        description,
        isPartOf: { "@id": `${siteUrl}#website` },
        inLanguage: languageCode
      }
    ].map((entry) =>
      Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined && value !== ""))
    );

    upsertJsonLd("site-graph", {
      "@context": "https://schema.org",
      "@graph": graph
    });
  }

  function updateHeadMeta() {
    const description = pageDescription();
    const title = pageTitle();
    const url = absolutePageUrl(currentPage);
    const image = absoluteAssetUrl(siteAsset("socialImage", "/assets/wmoi-mark.svg"));
    const icon = siteAsset("favicon", "../assets/wmoi-favicon.svg");

    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : currentLang;
    syncLangInUrl();
    document.title = title;
    setMeta('meta[name="theme-color"]', "content", content.site.themeColor || "#4A3BB2");
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:image"]', "content", image);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", image);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('link[rel="icon"]', "href", icon);
    updateAlternateMeta();
    updateStructuredData();
  }

  function updateAccessibilityCopy() {
    const skipLink = document.querySelector(".skip-link");
    if (skipLink) {
      skipLink.textContent = t(content.shared.accessibility && content.shared.accessibility.skipToContent);
    }
  }

  function renderHeader() {
    const showHeaderTag = !(content.site.assets && content.site.assets.showHeaderTag === false);
    const activeLanguage = LANGUAGES.find((item) => item.code === currentLang) || LANGUAGES[0];
    if (langSwitchOutsideHandler) {
      document.removeEventListener("click", langSwitchOutsideHandler);
      langSwitchOutsideHandler = null;
    }
    headerRoot.innerHTML = `
      <header class="site-header ${currentPage === "home" ? "is-home" : ""}">
        <div class="shell header-inner">
          <a class="brand" href="${withLang("./index.html")}" aria-label="${t(content.shared.accessibility && content.shared.accessibility.homeLabel)}">
            <img src="${siteAsset("lockup", "../assets/wmoi-lockup.svg")}" alt="${t(content.shared.accessibility && content.shared.accessibility.logoAlt)}" />
            ${showHeaderTag ? `<div class="brand-copy">
              <span>${t(content.shared.headerTag)}</span>
            </div>` : ""}
          </a>
          <nav class="site-nav" aria-label="${t(content.shared.accessibility && content.shared.accessibility.primaryNav)}">
            ${content.nav
              .map((item) => {
                const active = item.key === currentPage ? "is-active" : "";
                return `<a class="${active}" href="${withLang(item.href)}">${t(item.label)}</a>`;
              })
              .join("")}
          </nav>
          <div class="header-tools">
            <div class="lang-switch" data-lang-switch>
              <button class="lang-switch-trigger" type="button" data-lang-trigger aria-haspopup="listbox" aria-expanded="false" aria-label="${t(content.shared.accessibility && content.shared.accessibility.languageSelector)}">
                <span class="lang-switch-value">${activeLanguage ? activeLanguage.label : ""}</span>
              </button>
              <div class="lang-switch-menu" role="listbox" aria-label="${t(content.shared.accessibility && content.shared.accessibility.languageSelector)}">
                ${LANGUAGES
                  .map((item) => `<button class="lang-switch-option${item.code === currentLang ? " is-selected" : ""}" type="button" role="option" data-lang-option="${item.code}" aria-selected="${item.code === currentLang ? "true" : "false"}">${item.label}</button>`)
                  .join("")}
              </div>
            </div>
            ${inquiryButton("button-secondary")}
          </div>
        </div>
      </header>
    `;

    const langSwitch = headerRoot.querySelector("[data-lang-switch]");
    const langTrigger = headerRoot.querySelector("[data-lang-trigger]");
    if (langSwitch && langTrigger) {
      const closeLangSwitch = () => {
        langSwitch.classList.remove("is-open");
        langTrigger.setAttribute("aria-expanded", "false");
        if (langSwitchOutsideHandler) {
          document.removeEventListener("click", langSwitchOutsideHandler);
          langSwitchOutsideHandler = null;
        }
      };
      const openLangSwitch = () => {
        langSwitch.classList.add("is-open");
        langTrigger.setAttribute("aria-expanded", "true");
        langSwitchOutsideHandler = (event) => {
          if (!langSwitch.contains(event.target)) {
            closeLangSwitch();
          }
        };
        document.addEventListener("click", langSwitchOutsideHandler);
      };

      langTrigger.addEventListener("click", (event) => {
        event.stopPropagation();
        if (langSwitch.classList.contains("is-open")) {
          closeLangSwitch();
        } else {
          openLangSwitch();
        }
      });
      langTrigger.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeLangSwitch();
        }
      });
      headerRoot.querySelectorAll("[data-lang-option]").forEach((option) => {
        option.addEventListener("click", (event) => {
          event.stopPropagation();
          const nextLang = option.dataset.langOption;
          closeLangSwitch();
          loadLangContent(nextLang, (ok) => {
            if (!ok) return; // 语言文件加载失败时保持当前语言,避免渲染成兜底英文
            currentLang = nextLang;
            content = langContentCache[nextLang];
            safeStorageSet("wmoi-lang", currentLang);
            render();
          });
        });
      });
    }
  }

  function renderFooter() {
    const wechat = publicWechatValue();
    footerRoot.innerHTML = `
      <footer class="site-footer">
        <div class="shell footer-grid">
          <div class="footer-column footer-column--brand">
            <p class="footer-label">${t(content.shared.footer.portalLabel)}</p>
            <img class="footer-lockup" src="${siteAsset("lockupLight", "../assets/wmoi-lockup-light.svg")}" alt="${t(content.shared.accessibility && content.shared.accessibility.logoAlt)}" />
            <p class="footer-brand-copy">${t(content.shared.footerLead)}</p>
          </div>
          <div class="footer-column footer-column--about">
            <p class="footer-label">${t(content.site.brandFull)}</p>
            <p>${t(content.shared.footerBlurb)}</p>
          </div>
          <div class="footer-column footer-column--nav">
            <p class="footer-label">${t(content.shared.footer.navigateLabel)}</p>
            <ul class="footer-links">
              ${content.nav
                .map((item) => `<li><a href="${withLang(item.href)}">${t(item.label)}</a></li>`)
                .join("")}
            </ul>
          </div>
          <div class="footer-column footer-column--contact">
            <p class="footer-label">${t(content.shared.footer.contactLabel)}</p>
            <ul class="footer-links">
              <li><a href="mailto:${content.site.email}">${content.site.email}</a></li>
              ${wechat ? `<li>${t(content.shared.footer.wechatLabel)}: ${wechat}</li>` : ""}
              <li>${t(content.shared.footer.regionLabel)}: ${t(content.site.region)}</li>
            </ul>
          </div>
        </div>
        <div class="shell footer-bottom">
          <span>${t(content.shared.footerNote)}</span>
          <span>&copy; ${new Date().getFullYear()} ${content.site.brandShort}</span>
        </div>
      </footer>
    `;
  }

  function homeHeroCarousel() {
    const data = content.pages.home.carousel;
    if (!data || !data.slides || !data.slides.length) return "";
    const interval = Number(data.intervalMs) > 0 ? Number(data.intervalMs) : 5000;
    const slides = data.slides
      .map(
        (slide, index) => `
          <div
            class="home-carousel-slide${index === 0 ? " is-active" : ""}"
            role="group"
            aria-roledescription="slide"
            aria-label="${index + 1} / ${data.slides.length}"
            ${index === 0 ? "" : 'aria-hidden="true"'}
          >
            <img
              src="${slide.image}"
              alt="${t(slide.title)}"
              loading="${index === 0 ? "eager" : "lazy"}"
              ${index === 0 ? 'fetchpriority="high"' : ""}
              decoding="async"
            />
            <div class="home-carousel-badge">
              <p class="home-carousel-title">${t(slide.title)}</p>
              <p class="home-carousel-subtitle">${t(slide.subtitle)}</p>
            </div>
          </div>
        `
      )
      .join("");
    const dots = data.slides
      .map(
        (_, index) => `
          <button
            type="button"
            class="home-carousel-dot${index === 0 ? " is-active" : ""}"
            data-index="${index}"
            aria-label="Slide ${index + 1}"
          ></button>
        `
      )
      .join("");
    return `
     <section class="home-carousel" data-interval="${interval}" aria-roledescription="carousel">
       <div class="home-carousel-track">
         ${slides}
       </div>
        <button type="button" class="home-carousel-arrow home-carousel-arrow--prev" aria-label="上一张" data-dir="-1">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 4 7 10 13 16"/></svg>
        </button>
        <button type="button" class="home-carousel-arrow home-carousel-arrow--next" aria-label="下一张" data-dir="1">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 4 13 10 7 16"/></svg>
        </button>
        <div class="home-carousel-dots" role="tablist">
          ${dots}
        </div>
      </section>
    `;
  }

  function homeWhySection() {
    const data = content.pages.home.why;
    if (!data) return "";
    const title = t(data.title);
    const subtitle = t(data.subtitle);
    const alt = t(data.imageAlt) || title.replace(/<[^>]+>/g, "");
    const cards = Array.isArray(data.cards)
      ? data.cards
          .map((card) => {
            const cardTitle = t(card.title);
            const cardText = t(card.text);
            const icon = card.icon || "";
            const tone = card.iconTone || "neutral";
            return `
              <article class="home-why-card home-why-card--vertical" data-reveal>
                ${icon ? `<div class="home-why-card__icon home-why-card__icon--${tone}" aria-hidden="true"><span>${icon}</span></div>` : ""}
                ${cardTitle ? `<h3>${cardTitle}</h3>` : ""}
                ${cardText ? `<p>${cardText}</p>` : ""}
              </article>
            `;
          })
          .join("")
      : "";
    return `
      <section class="content-section home-why-section">
        <div class="shell">
          <div class="home-why-heading" data-reveal>
            <h2>${title}</h2>
            ${subtitle ? `<p class="home-why-subtitle">${subtitle}</p>` : ""}
          </div>
          ${cards ? `<div class="home-why-grid">${cards}</div>` : ""}
          <div class="home-why-visual" data-reveal>
            <img src="${currentLang === "zh" ? "https://wmo.mochance.xyz/img/chose-wmo-cn.jpg?v=20260610a" : "https://wmo.mochance.xyz/img/chose-wmo-en.png"}" alt="${alt}" loading="lazy" decoding="async" />
          </div>
        </div>
      </section>
    `;
  }

  function homeHistorySection() {
    const data = content.pages.home.history;
    if (!data || !Array.isArray(data.photos) || !data.photos.length) return "";
    const title = t(data.title);
    const subtitle = t(data.subtitle);
    const photos = data.photos
      .map(
        (photo) => `
          <div class="home-history-photo">
            <img src="${photo.image}" alt="${t(photo.alt) || title}" loading="lazy" decoding="async" />
          </div>
        `
      )
      .join("");
    // Duplicate the track so the CSS marquee loops seamlessly.
    return `
      <section class="content-section home-history-section">
        <div class="shell home-history-heading" data-reveal>
          <h2>${title}</h2>
          ${subtitle ? `<p class="home-history-subtitle">${subtitle}</p>` : ""}
          <span class="home-history-divider" aria-hidden="true"></span>
        </div>
        <div class="home-history-marquee" aria-roledescription="marquee" aria-label="${title}">
          <div class="home-history-track">
            ${photos}
            ${photos}
          </div>
        </div>
      </section>
    `;
  }

  function homeStatementSection() {
    const data = content.pages.home.statement;
    return `
      <section class="content-section home-statement-section">
        <div class="shell">
          ${sectionHeading("", t(data.title), t(data.text))}
          <div class="home-statement-grid">
            ${data.cards
              .map((item, index) => {
                const body = t(item.text);
                return `
                  <article class="statement-card" data-reveal>
                    <div class="statement-card__head">
                      <p class="card-step">${String(index + 1).padStart(2, "0")}</p>
                      <span class="statement-card__rule" aria-hidden="true"></span>
                    </div>
                    <h3>${t(item.title)}</h3>
                    ${body ? `<p>${body}</p>` : ""}
                  </article>
                `;
              })
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function sectionHeading(eyebrow, title, text) {
    return `
      <div class="section-heading" data-reveal>
        ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
        <h2>${title}</h2>
        ${text ? `<p class="section-copy">${text}</p>` : ""}
      </div>
    `;
  }

  function cardsSection(title, items, opts) {
    const sectionClass = opts && opts.sectionClass ? opts.sectionClass : "";
    const eyebrow = opts && opts.eyebrow ? opts.eyebrow : "";
    const text = opts && opts.text ? opts.text : "";
    const gridClass = opts && opts.gridClass ? opts.gridClass : "";
    const cardClass = opts && opts.cardClass ? opts.cardClass : "";
    return `
      <section class="content-section ${sectionClass}">
        <div class="shell">
          ${sectionHeading(eyebrow, title, text)}
          <div class="card-grid ${gridClass}">
            ${items
              .map(
                (item) => `
                  <article class="card ${cardClass}" data-reveal>
                    ${item.step ? `<span class="card-step">${item.step}</span>` : ""}
                    ${item.kicker ? `<p class="surface-label">${t(item.kicker)}</p>` : ""}
                    <h3>${t(item.title)}</h3>
                    <p>${t(item.text)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function resourceSection(title, items, opts) {
    const sectionClass = opts && opts.sectionClass ? opts.sectionClass : "";
    const eyebrow = opts && opts.eyebrow ? opts.eyebrow : "";
    const text = opts && opts.text ? opts.text : "";
    const gridClass = opts && opts.gridClass ? opts.gridClass : "";
    const cardClass = opts && opts.cardClass ? opts.cardClass : "";
    return `
      <section class="content-section ${sectionClass}">
        <div class="shell">
          ${sectionHeading(eyebrow, title, text)}
          <div class="resource-grid ${gridClass}">
            ${items
              .map(
                (item) => `
                  <article class="resource-card ${cardClass}" data-reveal>
                    <p class="surface-label">${t(item.kicker)}</p>
                    <h3>${t(item.title)}</h3>
                    <p>${t(item.text)}</p>
                    <a class="button button-secondary" href="${withLang(item.href)}">${t(item.label)}</a>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function gallerySection(title, items, opts) {
    const sectionClass = opts && opts.sectionClass ? opts.sectionClass : "";
    const eyebrow = opts && opts.eyebrow ? opts.eyebrow : "";
    const text = opts && opts.text ? opts.text : "";
    const gridClass = opts && opts.gridClass ? opts.gridClass : "";
    const cardClass = opts && opts.cardClass ? opts.cardClass : "";
    return `
      <section class="content-section ${sectionClass}">
        <div class="shell">
          ${sectionHeading(eyebrow, title, text)}
          <div class="gallery-grid ${gridClass}">
            ${items
              .map(
                (item) => `
                  <article class="gallery-card ${cardClass}" data-reveal>
                    <img src="${item.image}" alt="${t(item.title)}" loading="lazy" decoding="async" />
                    <div class="gallery-card-copy">
                      <h3>${t(item.title)}</h3>
                      <p>${t(item.text)}</p>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function timeline(items) {
    const publishedItems = items.filter((item) => !isPendingDate(item.date));
    if (!publishedItems.length) {
      return `
        <article class="note-panel" data-reveal>
          <p class="surface-label">${t(content.shared.common.timelineFallback.label)}</p>
          <h2>${t(content.shared.common.timelineFallback.title)}</h2>
          <p>${t(content.shared.common.timelineFallback.text)}</p>
        </article>
      `;
    }

    return `
      <div class="timeline">
        ${publishedItems
          .map(
            (item) => {
              const badge = item.badge ? t(item.badge) : "";

              return `
              <article class="timeline-item" data-reveal>
                <span>${item.date || item.step}</span>
                <div>
                  <h3>${t(item.title)}</h3>
                  ${badge ? `<p class="timeline-badge">${badge}</p>` : ""}
                  ${item.text ? `<p>${t(item.text)}</p>` : ""}
                </div>
              </article>
            `;
            }
          )
          .join("")}
      </div>
    `;
  }

  function mediaList(items) {
    return `
      <div class="media-list">
        ${items
          .map(
            (item) => `
              <article class="media-card" data-reveal>
                <span>${t(item.outlet)}</span>
                <h3>${t(item.title)}</h3>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function partnersList(items) {
    return `
      <div class="partner-grid">
        ${items.map((item) => `<div class="partner-chip" data-reveal>${t(item)}</div>`).join("")}
      </div>
    `;
  }

  function formatStagesCards(data) {
    const fmt = data.formatStages;
    if (!fmt || !fmt.stages || !fmt.stages.length) return "";
    const variant = { active: " format-stage--active", highlight: " format-stage--highlight" };
    return `
      <div class="format-stages-block" data-reveal>
        <p class="eyebrow format-stages-eyebrow">${t(fmt.title)}</p>
        <div class="format-stages">
          ${fmt.stages
            .map(
              (stage) => `
                <div class="format-stage${variant[stage.state] || ""}">
                  <p class="format-stage-phase">${t(stage.phase)}</p>
                  <h3 class="format-stage-name">${t(stage.name)}</h3>
                  <div class="format-stage-detail">
                    ${stage.lines.map((line) => `<p>${t(line)}</p>`).join("")}
                  </div>
                  <span class="format-stage-status">${t(stage.status)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function currentEventsSection(data) {
    const ce = data.currentEvents;
    if (!ce || !ce.events || !ce.events.length) return "";
    const icons = {
      calendar: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="14" height="12.5" rx="2.2"/><path d="M3 8.4h14"/><path d="M6.6 2.8v3M13.4 2.8v3"/></svg>',
      location: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17.6c3.4-3.8 5.4-6.6 5.4-9.1A5.4 5.4 0 1 0 4.6 8.5c0 2.5 2 5.3 5.4 9.1Z"/><circle cx="10" cy="8.2" r="2"/></svg>',
      people: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.4" cy="7" r="2.5"/><path d="M2.8 16c0-2.6 2.1-4.3 4.6-4.3S12 13.4 12 16"/><path d="M13.2 5.1a2.5 2.5 0 0 1 0 4.7"/><path d="M14.1 11.9c1.9.4 3.1 1.9 3.1 4.1"/></svg>',
      star: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.8l2.2 4.5 5 .7-3.6 3.5.85 4.95L10 14.6l-4.45 2.35.85-4.95L2.8 8l5-.7Z"/></svg>',
    };
    return `
      <section class="content-section current-events-section">
        <div class="shell">
          <p class="eyebrow current-events-eyebrow" data-reveal>${t(ce.title)}</p>
          <div class="current-events" data-reveal>
            ${ce.events
              .map(
                (ev) => `
                  <article class="event-card event-card--${ev.variant}">
                    <div class="event-card-head">
                      <span class="event-tag">${t(ev.tag)}</span>
                      <span class="event-status event-status--${ev.statusType}">${t(ev.status)}</span>
                    </div>
                    <h3 class="event-card-title">${t(ev.title)}</h3>
                    <ul class="event-meta">
                      ${ev.meta
                        .map(
                          (m) => `
                            <li><span class="event-meta-icon" aria-hidden="true">${icons[m.icon] || ""}</span><span>${t(m.text)}</span></li>
                          `
                        )
                        .join("")}
                    </ul>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function latestUpdatesSection(data) {
    const lu = data.latestUpdates;
    if (!lu || !lu.items || !lu.items.length) return "";
    return `
      <section class="content-section latest-updates-section">
        <div class="shell">
          <p class="eyebrow latest-updates-eyebrow" data-reveal>${t(lu.title)}</p>
          <div class="latest-updates" data-reveal>
            ${lu.items
              .map(
                (item) => `
                  <div class="update-row">
                    <div class="update-row-main">
                      <span class="update-dot update-dot--${item.dot}" aria-hidden="true"></span>
                      <span class="update-row-text">${t(item.text)}</span>
                    </div>
                    <span class="update-row-date">${t(item.date)}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function homeStatsParallax() {
    const statsData = content.pages.home.statistics;
    if (!statsData) return "";

    return `
      <section class="parallax-stats-section" aria-label="WMO Global Impact Statistics">
        <div class="parallax-stats-bg"></div>
        <div class="shell parallax-stats-shell" data-reveal>
          <div class="parallax-stats-header">
            <p class="stats-kicker">${t(statsData.kicker)}</p>
            <h2 class="stats-title">${localizedBreakLineMarkup(statsData.title, "stats-title-line")}</h2>
          </div>
          <div class="parallax-stats-grid">
            ${statsData.metrics
              .map(
                (item) => {
                  const rawVal = item.value || "";
                  const cleanVal = rawVal.replace(/,/g, "");
                  const numMatch = cleanVal.match(/^(\d+)(?!\.\d)/);
                  if (numMatch) {
                    const target = numMatch[1];
                    const suffix = cleanVal.substring(numMatch[0].length);
                    const useComma = rawVal.includes(",");
                    return `
                      <div class="stats-item">
                        <div class="stats-value">
                          <span class="stats-number" data-count="${target}" data-use-comma="${useComma}" data-duration="3000" data-easing="linear">0</span><span class="stats-suffix">${suffix}</span>
                        </div>
                        <div class="stats-label">${t(item.label)}</div>
                      </div>
                    `;
                  }
                  return `
                    <div class="stats-item">
                      <div class="stats-value">${rawVal}</div>
                      <div class="stats-label">${t(item.label)}</div>
                    </div>
                  `;
                }
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function contactRibbon() {
    return `
      <section class="contact-ribbon">
        <div class="shell ribbon-grid" data-reveal>
          <div class="ribbon-copy">
            <p class="footer-label">${t(content.shared.contactRibbon.kicker)}</p>
            <h2>${t(content.shared.contactRibbon.title)}</h2>
            <p>${t(content.shared.contactRibbon.text)}</p>
          </div>
          <div class="ribbon-actions">
            ${inquiryButton("button-primary")}
            <a class="button button-ghost" href="mailto:${content.site.email}">${content.site.email}</a>
          </div>
        </div>
      </section>
    `;
  }

  function contactChannels() {
    const channels = visibleContactChannels();
    return `
      <div class="channel-stack">
        ${channels
          .map(
            (channel) => `
              <article class="channel-card" data-reveal>
                <span>${t(channel.title)}</span>
                <strong>${t(channel.value)}</strong>
                <p>${t(channel.note)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function aboutHeroSection(data) {
    return `
      <section class="page-hero page-hero--editorial page-hero--about">
        <div class="shell page-hero-shell">
          <div class="page-hero-copy" data-reveal>
            <p class="eyebrow">${t(data.hero.eyebrow)}</p>
            <h1>${aboutHeroTitleMarkup(data.hero.title)}</h1>
            <p class="hero-text">${t(data.hero.text)}</p>
            <div class="hero-actions hero-actions-placeholder">
              ${inquiryButton("button-primary")}
            </div>
          </div>
          <div class="page-hero-visual" data-reveal>
            <img src="${data.hero.image || content.pages.home.hero.image}" alt="${t(data.hero.title)}" decoding="async" fetchpriority="high" />
          </div>
        </div>
      </section>
    `;
  }

  function aboutHighlightsSection(data) {
    return `
      <section class="content-section about-highlights-section">
        <div class="shell">
          <div class="about-highlights-head" data-reveal>
            <p class="eyebrow">${t(data.sections.hero.panelLabel)}</p>
          </div>
          <div class="card-grid about-highlights-grid">
            ${data.highlights
              .map(
                (item, index) => `
                  <article class="card card--about-highlight" data-reveal>
                    <div class="card--about-highlight__head">
                      <span class="card--about-highlight__index">${String(index + 1).padStart(2, "0")}</span>
                      <span class="card--about-highlight__rule" aria-hidden="true"></span>
                    </div>
                    <h3>${t(item.title)}</h3>
                    <p>${t(item.text)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function aboutAssessmentSection(data) {
    const section = data.sections.assessment;
    if (!section) return "";
    const tabs = section.tabs || [];
    return `
      <section class="content-section about-assessment-section">
        <div class="shell">
          ${sectionHeading("", t(section.title), t(section.text))}
          <div class="assessment-tabs" data-assessment-tabs>
            <div class="assessment-tab-list" role="tablist">
              ${tabs
                .map(
                  (tab, index) => `
                    <button
                      type="button"
                      class="assessment-tab${index === 0 ? " is-active" : ""}"
                      role="tab"
                      aria-selected="${index === 0 ? "true" : "false"}"
                      data-assessment-tab="${index}"
                    >
                      <span class="assessment-tab-index">${String(index + 1).padStart(2, "0")}</span>
                      <span class="assessment-tab-label">${t(tab.title)}</span>
                    </button>
                  `
                )
                .join("")}
            </div>
            <div class="assessment-panels">
              ${tabs
                .map(
                  (tab, index) => `
                    <article
                      class="assessment-panel${index === 0 ? " is-active" : ""}"
                      role="tabpanel"
                      data-assessment-panel="${index}"
                      aria-hidden="${index === 0 ? "false" : "true"}"
                      data-reveal
                    >
                      <div class="assessment-panel-media">
                        <img src="${tab.image}" alt="${t(tab.title)}" loading="lazy" />
                      </div>
                      <div class="assessment-panel-copy">
                        <p class="eyebrow">${String(index + 1).padStart(2, "0")}</p>
                        <h3>${t(tab.title)}</h3>
                        <p>${t(tab.text)}</p>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bindAssessmentTabs() {
    const wrapper = document.querySelector("[data-assessment-tabs]");
    if (!wrapper) return;
    const tabs = wrapper.querySelectorAll("[data-assessment-tab]");
    const panels = wrapper.querySelectorAll("[data-assessment-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-assessment-tab");
        tabs.forEach((other) => {
          const isActive = other === tab;
          other.classList.toggle("is-active", isActive);
          other.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        panels.forEach((panel) => {
          const isActive = panel.getAttribute("data-assessment-panel") === target;
          panel.classList.toggle("is-active", isActive);
          panel.setAttribute("aria-hidden", isActive ? "false" : "true");
        });
      });
    });
  }

  function aboutTextbooksSection(data) {
    const heading = data.sections.textbooks;
    const groups = (data.textbooks && data.textbooks.groups) || [];
    return `
      <section class="content-section about-textbooks-section">
        <div class="shell">
          ${sectionHeading("", t(heading.title), "")}
          <div class="textbook-rows">
            ${groups
              .map((group) => {
                const groupHeading = t(group.heading);
                return `
                  <div class="textbook-row" data-reveal>
                    <div class="textbook-row-head">
                      ${groupHeading ? `<h3 class="textbook-row-title">${groupHeading}</h3>` : ""}
                      <div class="textbook-row-nav">
                        <button type="button" class="textbook-arrow textbook-arrow--prev" aria-label="上一张" data-dir="-1">&#8249;</button>
                        <button type="button" class="textbook-arrow textbook-arrow--next" aria-label="下一张" data-dir="1">&#8250;</button>
                      </div>
                    </div>
                    <div class="textbook-track">
                      ${group.items
                        .map(
                          (item) => `
                            <article class="textbook-card">
                              <div class="textbook-card-cover">
                                <img src="${item.image}" alt="${t(item.label)}" loading="lazy" />
                              </div>
                              <span class="textbook-card-label">
                                <span class="textbook-card-grade">${t(item.label)}</span>
                                <span class="textbook-card-arrow" aria-hidden="true">&#8594;</span>
                              </span>
                            </article>
                          `
                        )
                        .join("")}
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function trustHeroSection(data) {
    const slides = [
      "https://wmo.mochance.xyz/assets/trust_slider/new_1.jpg?v=20260613a",
      "https://wmo.mochance.xyz/assets/trust_slider/1.jpg?v=20260613a",
      "https://wmo.mochance.xyz/assets/trust_slider/3.jpg?v=20260613a",
      "https://wmo.mochance.xyz/assets/trust_slider/4.jpg?v=20260613a"
    ];
    const slideMarkup = slides.map((src, index) => `
      <div class="trust-carousel-slide${index === 0 ? " is-active" : ""}">
        <img src="${src}" alt="Trust Image ${index + 1}" loading="${index === 0 ? "eager" : "lazy"}" />
      </div>
    `).join("");
    
    const dotsMarkup = slides.map((_, index) => `
      <button class="trust-carousel-dot${index === 0 ? " is-active" : ""}" data-index="${index}" aria-label="Slide ${index + 1}"></button>
    `).join("");

    return `
      <section class="page-hero page-hero--editorial page-hero--trust">
        <div class="shell page-hero-shell">
          <div class="page-hero-copy" data-reveal>
            <p class="eyebrow">${t(data.hero.eyebrow)}</p>
            <h1>${trustHeroTitleMarkup(data.hero.title)}</h1>
            <p class="hero-text">${t(data.hero.text)}</p>
            <div class="hero-actions hero-actions-placeholder">
              ${inquiryButton("button-primary")}
            </div>
          </div>
          <div class="page-hero-visual trust-carousel-container" data-reveal style="position: relative; overflow: hidden; aspect-ratio: 3 / 2; width: 100%; height: auto;">
            ${slideMarkup}
            <div class="trust-carousel-dots">
              ${dotsMarkup}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function newsHeroSection(data) {
    return `
      <section class="page-hero page-hero--editorial page-hero--news news-top">
        <div class="shell news-top-grid">
          <div class="news-top-main">
            <div class="page-hero-copy" data-reveal>
              <p class="eyebrow">${t(data.hero.eyebrow)}</p>
              <h1>${t(data.hero.title)}</h1>
              <p class="hero-text">${t(data.hero.text)}</p>
              <div class="hero-actions hero-actions-placeholder">
                ${inquiryButton("button-primary")}
              </div>
              <div class="page-hero-panel page-hero-panel--news hero-stats" data-reveal>
                ${data.sections.hero.heroStats
                  .map(
                    (stat) => `
                      <div class="hero-stat">
                        <span class="hero-stat-value">${t(stat.value)}</span>
                        <span class="hero-stat-label">${t(stat.label)}</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
            ${formatStagesCards(data)}
          </div>
          ${newsHeroGallery(data)}
        </div>
      </section>
    `;
  }

  function newsHeroGallery(data) {
    const gallery = data.hero && data.hero.gallery;
    const slides = gallery && Array.isArray(gallery.slides) && gallery.slides.length
      ? gallery.slides
      : [{ image: data.hero.image || content.pages.home.hero.image, alt: data.hero.title }];
    const slideMarkup = slides
      .map(
        (slide, index) => `
          <figure
            class="news-hero-carousel__slide${index === 0 ? " is-active" : ""}"
            role="group"
            aria-roledescription="slide"
            aria-label="${index + 1} / ${slides.length}"
            aria-current="${index === 0 ? "true" : "false"}"
          >
            <img
              src="${slide.image}"
              alt="${t(slide.alt || data.hero.title)}"
              loading="${index < 2 ? "eager" : "lazy"}"
              decoding="async"
            />
          </figure>
        `
      )
      .join("");
    const dots = slides
      .map(
        (_, index) => `
          <button
            type="button"
            class="news-hero-carousel__dot${index === 0 ? " is-active" : ""}"
            data-index="${index}"
            aria-label="${index + 1} / ${slides.length}"
            aria-selected="${index === 0 ? "true" : "false"}"
          ></button>
        `
      )
      .join("");
    const controls = slides.length > 1
      ? `
          <div class="news-hero-carousel__dots" role="tablist" aria-label="${t({ en: "News images", zh: "新闻页图片" })}">
            ${dots}
          </div>
        `
      : "";
    return `
      <div class="news-top-visual" data-reveal>
        <div class="news-hero-carousel" data-slide-count="${slides.length}" aria-roledescription="carousel">
          <div class="news-hero-carousel__track">
            ${slideMarkup}
          </div>
          ${controls}
        </div>
      </div>
    `;
  }

  function contactFaqSection(data) {
    return `
      <section class="content-section contact-faq-section">
        <div class="shell">
          ${sectionHeading(
            t(data.sections.faq.eyebrow),
            t(data.sections.faq.title),
            t(data.sections.faq.text)
          )}
          <div class="home-statement-grid contact-faq-grid">
            ${data.faq
              .map((item, index) => {
                const body = t(item.text);
                return `
                  <article class="statement-card statement-card--faq" data-reveal>
                    <div class="statement-card__head">
                      <p class="card-step">${String(index + 1).padStart(2, "0")}</p>
                      <span class="statement-card__rule" aria-hidden="true"></span>
                    </div>
                    <h3>${t(item.title)}</h3>
                    ${body ? `<p>${body}</p>` : ""}
                  </article>
                `;
              })
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderHome() {
    return `
      ${homeHeroCarousel()}
      ${homeStatementSection()}
      ${homeStatsParallax()}
      ${homeWhySection()}
      ${homeHistorySection()}
    `;
  }

  function renderAbout() {
    const data = content.pages.about;
    return `
      ${aboutHeroSection(data)}
      ${aboutHighlightsSection(data)}
      ${aboutTextbooksSection(data)}
      ${aboutAssessmentSection(data)}
      ${gallerySection(t(data.sections.visuals.title), data.visuals, {
        eyebrow: t(data.sections.visuals.eyebrow),
        text: t(data.sections.visuals.text),
        sectionClass: "about-visuals-section",
        gridClass: "about-visual-grid",
        cardClass: "gallery-card--about"
      })}
    `;
  }

  function countriesCarousel(data) {
    if (!data.countries || !data.countries.items || !data.countries.items.length) return "";
    const items = data.countries.items;
    const id = "countries-carousel-" + Math.random().toString(36).slice(2, 8);
    return `
      <section class="content-section countries-carousel-section">
        <div class="shell">
          <div class="countries-carousel" id="${id}" data-reveal>
            <div class="countries-carousel-captions">
              ${items.map((item, i) => `
                <div class="countries-carousel-caption ${i === 0 ? "is-active" : ""}">
                  <span class="countries-carousel-label">${t(item.caption)}</span>
                  <p>${t(item.text)}</p>
                </div>
              `).join("")}
            </div>
            <div class="countries-carousel-stage">
              <div class="countries-carousel-viewport">
                <div class="countries-carousel-track">
                  ${items.map((item, i) => `
                  <div class="countries-carousel-slide ${i === 0 ? "is-active" : ""}" data-index="${i}">
                    <img src="${item.image}" alt="${t(item.caption)}" loading="${i === 0 ? "eager" : "lazy"}" decoding="async" />
                  </div>
                  `).join("")}
                </div>
              </div>
              <button class="countries-carousel-arrow countries-carousel-arrow--prev" aria-label="Previous" data-dir="-1">&#8249;</button>
              <button class="countries-carousel-arrow countries-carousel-arrow--next" aria-label="Next" data-dir="1">&#8250;</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function trustVideoSection(data) {
    const v = data.videoIntro;
    if (!v || !v.src) return "";
    return `
      <section class="content-section trust-video-section">
        <div class="shell">
          ${sectionHeading(t(v.eyebrow), t(v.title), t(v.text))}
          <figure class="trust-video" data-reveal>
            <video
              class="trust-video__player"
              controls
              preload="none"
              playsinline
              poster="${v.poster}"
            >
              <source src="${v.src}" type="video/mp4" />
            </video>
            <button type="button" class="trust-video__cover" aria-label="${t(v.title)}" style="background-image:url('${v.poster}')">
              <span class="trust-video__play" aria-hidden="true"></span>
            </button>
          </figure>
        </div>
      </section>
    `;
  }

  function renderTrust() {
    const data = content.pages.trust;
    return `
      ${trustHeroSection(data)}
      ${countriesCarousel(data)}
      ${trustVideoSection(data)}
    `;
  }

  function bindTrustVideo() {
    const fig = document.querySelector(".trust-video");
    if (!fig) return;
    const video = fig.querySelector(".trust-video__player");
    const cover = fig.querySelector(".trust-video__cover");
    if (!video || !cover) return;
    const showCover = () => fig.classList.remove("is-playing");
    const hideCover = () => fig.classList.add("is-playing");
    cover.addEventListener("click", () => {
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
    video.addEventListener("play", hideCover);
    video.addEventListener("playing", hideCover);
    video.addEventListener("pause", showCover);
    video.addEventListener("ended", showCover);
  }

function chongqingFeaturesSection(data) {
  if (!data.chongqingFeatures || !data.chongqingFeatures.items) return "";
  return `
    <section class="content-section news-archive-section chongqing-features-section" style="padding-bottom: 20px;">
      <div class="shell">
        ${sectionHeading(
          "",
          t(data.chongqingFeatures.title),
          t(data.chongqingFeatures.text)
        )}
        <div class="features-list" data-reveal style="background: rgba(var(--accent-a-rgb, 103,173,174), 0.08); padding: 48px; border-radius: 14px;">
          ${data.chongqingFeatures.items.map((item, index) => `
            <div style="padding: 28px 0; border-bottom: 1px solid rgba(18,22,44,0.1); position: relative;">
              <div style="max-width: none;">
                <h3 style="font-size: 1.4rem; color: var(--forest-980); margin: 0 0 12px; font-weight: 600;">${t(item.title)}</h3>
                <p style="color: var(--forest-800); font-size: 1.05rem; line-height: 1.6; margin: 0;">${t(item.text)}</p>
              </div>
            </div>
          `).join("")}
          
          <div style="display: flex; justify-content: flex-end; padding-top: 28px;">
            <a href="#" aria-label="Official Account Link" style="display: inline-flex; align-items: center;">
              <svg width="50" height="20" viewBox="0 0 50 20" fill="none" stroke="var(--forest-900)" stroke-width="1.2">
                <path d="M0 10h48M40 2l8 8-8 8"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function newsResourcesSection(data) {
  if (!data.sections || !data.sections.resources || !data.resources) return "";
  return resourceSection(
    t(data.sections.resources.title),
    data.resources,
    {
      eyebrow: t(data.sections.resources.eyebrow),
      text: t(data.sections.resources.text),
      sectionClass: "news-resources-section", gridClass: "news-resource-grid", cardClass: "resource-card--news"
    }
  );
}

function archiveAccordionSection(data) {
  if (!data.sections || !data.sections.archive || !data.archive) return "";
  return `
    <section class="content-section news-archive-section" style="padding-bottom: 80px;">
      <div class="shell">
        ${sectionHeading(
          "",
          t(data.sections.archive.title),
          t(data.sections.archive.text)
        )}
        <div class="accordion-list" data-reveal>
          ${data.archive
            .map(
              (item) => `
              <div class="accordion-item">
                <button type="button" class="accordion-trigger" aria-expanded="false">
                  <div class="accordion-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                  <span class="accordion-title">${t(item.kicker)}</span>
                  <span class="accordion-subtitle">${t(item.title)}</span>
                </button>
                <div class="accordion-content">
                  <p>${t(item.text)}</p>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

  function renderNews() {
    const data = content.pages.news;
    return `
      ${newsHeroSection(data)}
      ${currentEventsSection(data)}
      ${latestUpdatesSection(data)}
      ${chongqingFeaturesSection(data)}
    `;
  }

  function inquiryFormShell() {
    const form = content.shared.form;
    return `
      <h2>${t(form.title)}</h2>
      <div class="form-submission-notice" data-reveal>
        <span class="form-submission-notice-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>
        </span>
        <p class="form-submission-notice-text">
          <span>${t(form.submissionNotice)}</span>
          <strong>${content.site.email}</strong>
        </p>
      </div>
      <form id="inquiry-form" class="inquiry-form">
        <label>
          <span>${t(form.fields.name)}</span>
          <input name="name" type="text" required />
        </label>
        <label>
          <span>${t(form.fields.email)}</span>
          <input name="email" type="email" required />
        </label>
        <label>
          <span>${t(form.fields.country)}</span>
          <input name="country" type="text" required />
        </label>
        <label>
          <span>${t(form.fields.role)}</span>
          <div class="custom-select">
            <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="custom-select-label is-placeholder">${t(form.selectPlaceholder)}</span>
              <svg class="custom-select-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>
            </button>
            <ul class="custom-select-options" role="listbox">
              <li class="custom-select-option is-selected" role="option" data-value="">${t(form.selectPlaceholder)}</li>
              ${form.roles
                .map((role) => `<li class="custom-select-option" role="option" data-value="${role.value}">${t(role.label)}</li>`)
                .join("")}
            </ul>
            <input type="hidden" name="role" value="" />
          </div>
        </label>
        <label>
          <span>${t(form.fields.organization)}</span>
          <input name="organization" type="text" />
        </label>
        <label class="full-width">
          <span>${t(form.fields.message)}</span>
          <textarea name="message" rows="6" required></textarea>
        </label>
        <button class="button button-primary" type="submit">${t(form.fields.submit)}</button>
        <p class="form-status" id="form-status" aria-live="polite"></p>
      </form>
    `;
  }

  function inquiryButton(variant) {
    return `<a class="button ${variant || "button-primary"}" href="${withLang(pageUrl("contact"))}" data-open-inquiry>${t(content.shared.primaryCta)}</a>`;
  }

  function inquiryModalMarkup() {
    return `
      <div class="inquiry-modal" id="inquiry-modal" hidden>
        <div class="inquiry-modal-backdrop" data-close-inquiry></div>
        <div class="inquiry-modal-dialog" role="dialog" aria-modal="true" aria-label="${t(content.shared.form.title)}">
          <button class="inquiry-modal-close" type="button" data-close-inquiry aria-label="Close">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>
          </button>
          <div class="form-shell">
            ${inquiryFormShell()}
          </div>
        </div>
      </div>
    `;
  }

  function renderContact() {
    const data = content.pages.contact;
    return `
      <section class="content-section">
        <div class="shell contact-layout">
          <div class="contact-route-column">
            ${sectionHeading(
            t(data.sections.channels.eyebrow),
            t(data.sections.channels.title),
            t(data.sections.channels.text)
            )}
            ${contactChannels()}
          </div>
          <div class="form-shell" data-reveal>
            ${inquiryFormShell()}
          </div>
        </div>
      </section>
      ${contactFaqSection(data)}
    `;
  }

  const renderers = {
    home: renderHome,
    about: renderAbout,
    awards: renderAbout,
    trust: renderTrust,
    news: renderNews,
    contact: renderContact
  };

  let customSelectOutsideBound = false;
  function bindCustomSelects(scope) {
    const selects = (scope || document).querySelectorAll(".custom-select");
    selects.forEach((sel) => {
      if (sel.dataset.bound) return;
      sel.dataset.bound = "1";
      const trigger = sel.querySelector(".custom-select-trigger");
      const labelEl = sel.querySelector(".custom-select-label");
      const hidden = sel.querySelector('input[type="hidden"]');
      const opts = Array.prototype.slice.call(sel.querySelectorAll(".custom-select-option"));
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = !sel.classList.contains("is-open");
        document.querySelectorAll(".custom-select.is-open").forEach((other) => {
          if (other !== sel) {
            other.classList.remove("is-open");
            other.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
          }
        });
        sel.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
      });
      opts.forEach((opt) => {
        opt.addEventListener("click", (event) => {
          event.preventDefault();
          opts.forEach((o) => o.classList.remove("is-selected"));
          opt.classList.add("is-selected");
          hidden.value = opt.getAttribute("data-value") || "";
          labelEl.textContent = opt.textContent;
          labelEl.classList.toggle("is-placeholder", !hidden.value);
          sel.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
    });
    if (!customSelectOutsideBound) {
      customSelectOutsideBound = true;
      document.addEventListener("click", () => {
        document.querySelectorAll(".custom-select.is-open").forEach((sel) => {
          sel.classList.remove("is-open");
          sel.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  function bindForm() {
    const form = document.getElementById("inquiry-form");
    if (!form) {
      return;
    }

    bindCustomSelects(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const roleValue = String(data.get("role") || "");
      const roleEntry = content.shared.form.roles.find((role) => role.value === roleValue);
      const roleLabel = roleEntry ? t(roleEntry.label) : t(content.shared.form.generalRole);
      const mailLabels = {
        name: t(content.shared.form.fields.name),
        email: t(content.shared.form.fields.email),
        country: t(content.shared.form.fields.country),
        role: t(content.shared.form.fields.role),
        organization: t(content.shared.form.fields.organization),
        message: t(content.shared.form.fields.message),
        language: t(content.shared.form.fields.language)
      };
      const body = [
        `${mailLabels.name}: ${data.get("name")}`,
        `${mailLabels.email}: ${data.get("email")}`,
        `${mailLabels.country}: ${data.get("country")}`,
        `${mailLabels.role}: ${roleLabel}`,
        `${mailLabels.organization}: ${data.get("organization") || "-"}`,
        `${mailLabels.language}: ${LANGUAGES.find((item) => item.code === currentLang)?.label || currentLang}`,
        "",
        `${mailLabels.message}:`,
        `${data.get("message")}`
      ].join("\n");
      const subject = encodeURIComponent(`${t(content.shared.form.subjectPrefix)} - ${roleLabel}`);
      window.location.href = `mailto:${content.site.email}?subject=${subject}&body=${encodeURIComponent(body)}`;

      const status = document.getElementById("form-status");
      if (status) {
        status.textContent = t(content.shared.form.success);
      }
    });

  }

  function bindRevealMotion() {
    const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!revealItems.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  function bindCountMotion() {
    const counters = Array.from(document.querySelectorAll("[data-count]"));
    if (!counters.length) {
      return;
    }

    const animate = (node) => {
      if (node.dataset.animated === "true") {
        return;
      }

      node.dataset.animated = "true";
      const target = Number(node.dataset.count);
      const suffix = node.dataset.suffix || "";
      const duration = Number(node.dataset.duration) || 900;
      const easing = node.dataset.easing || "easeOutCubic";
      const startTime = performance.now();

      function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = easing === "linear" ? progress : 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.round(target * eased);
        const displayVal = node.dataset.useComma === "true" ? currentVal.toLocaleString("en-US") : currentVal;
        node.textContent = `${displayVal}${suffix}`;
        if (progress < 1) {
          window.requestAnimationFrame(tick);
        }
      }

      window.requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          animate(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15 }
    );

    counters.forEach((counter) => observer.observe(counter));
  }

  function bindTrustCarousel() {
    const container = document.querySelector(".trust-carousel-container");
    if (!container) return;
    const slides = Array.from(container.querySelectorAll(".trust-carousel-slide"));
    const dots = Array.from(container.querySelectorAll(".trust-carousel-dot"));
    if (slides.length <= 1) return;

    let current = 0;
    let timer = null;
    const interval = 4000;

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
    }

    function next() {
      show(current + 1);
    }

    function start() {
      stop();
      timer = window.setInterval(next, interval);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        show(i);
        start();
      });
    });

    container.addEventListener("mouseenter", stop);
    container.addEventListener("mouseleave", start);
    
    start();
  }

  function bindHomeCarousel() {
    const section = document.querySelector(".home-carousel");
    if (!section) return;
    const slides = Array.from(section.querySelectorAll(".home-carousel-slide"));
    const dots = Array.from(section.querySelectorAll(".home-carousel-dot"));
    if (slides.length <= 1) return;

    const interval = Math.max(2000, Number(section.dataset.interval) || 5000);
    let current = 0;
    let timer = null;

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-current", active ? "true" : "false");
      });
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
    }

    function next() {
      show(current + 1);
    }

    function start() {
      stop();
      timer = window.setInterval(next, interval);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

   dots.forEach((dot, i) =>
     dot.addEventListener("click", () => {
       show(i);
       start();
     })
   );

    section.querySelectorAll(".home-carousel-arrow").forEach((btn) =>
      btn.addEventListener("click", () => {
        const dir = Number(btn.dataset.dir) || 1;
        show(current + dir);
        start();
      })
    );

    section.addEventListener("mouseenter", stop);
    section.addEventListener("mouseleave", start);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    start();
  }

  function bindNewsHeroCarousel() {
    const carousel = document.querySelector(".news-hero-carousel");
    if (!carousel) return;
    const track = carousel.querySelector(".news-hero-carousel__track");
    const slides = Array.from(carousel.querySelectorAll(".news-hero-carousel__slide"));
    const dots = Array.from(carousel.querySelectorAll(".news-hero-carousel__dot"));
    if (!track || slides.length <= 1) return;

    let current = 0;
    let visualIndex = 1;
    let isWrapping = false;
    let touchStartX = 0;
    let wrapTimer = 0;
    let autoTimer = 0;
    const autoInterval = 5000;

    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    [firstClone, lastClone].forEach((clone) => {
      clone.classList.remove("is-active");
      clone.classList.add("is-clone");
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("aria-current", "false");
    });
    track.insertBefore(lastClone, slides[0]);
    track.appendChild(firstClone);
    const visualSlides = Array.from(track.querySelectorAll(".news-hero-carousel__slide"));

    function slideScrollLeft(index, list = visualSlides) {
      return Math.max(0, list[index].offsetLeft - track.offsetLeft);
    }

    function setActive(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-current", active ? "true" : "false");
      });
      dots.forEach((dot, i) => {
        const active = i === current;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    function jumpTo(index) {
      visualIndex = index;
      track.scrollLeft = slideScrollLeft(visualIndex);
    }

    function animateTo(index) {
      visualIndex = index;
      track.scrollTo({
        left: slideScrollLeft(visualIndex),
        behavior: "smooth",
      });
    }

    function finishWrap(index, visualTarget) {
      window.clearTimeout(wrapTimer);
      wrapTimer = window.setTimeout(() => {
        setActive(index);
        jumpTo(visualTarget);
        isWrapping = false;
      }, 520);
    }

    function show(index) {
      if (isWrapping) return;

      if ((current === slides.length - 1 && index === 0) || index === slides.length) {
        isWrapping = true;
        setActive(0);
        animateTo(slides.length + 1);
        finishWrap(0, 1);
        return;
      }

      if ((current === 0 && index === slides.length - 1) || index < 0) {
        isWrapping = true;
        setActive(slides.length - 1);
        animateTo(0);
        finishWrap(slides.length - 1, slides.length);
        return;
      }

      setActive(index);
      animateTo(current + 1);
    }

    function stopAuto() {
      window.clearInterval(autoTimer);
      autoTimer = 0;
    }

    function startAuto() {
      if (autoTimer || document.hidden) return;
      autoTimer = window.setInterval(() => {
        show(current + 1);
      }, autoInterval);
    }

    function restartAuto() {
      stopAuto();
      startAuto();
    }

    function manualShow(index) {
      show(index);
      restartAuto();
    }

    function reposition() {
      jumpTo(current + 1);
    }

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        manualShow(index);
      });
    });

    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        manualShow(current - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        manualShow(current + 1);
      }
    });

    carousel.addEventListener("touchstart", (event) => {
      touchStartX = event.touches[0] ? event.touches[0].clientX : 0;
    }, { passive: true });

    carousel.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      if (!touchStartX || !touch) return;
      const delta = touch.clientX - touchStartX;
      if (Math.abs(delta) > 40) {
        manualShow(current + (delta < 0 ? 1 : -1));
      }
      touchStartX = 0;
    }, { passive: true });

    window.addEventListener("resize", reposition);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAuto();
      else restartAuto();
    });

    setActive(0);
    jumpTo(1);
    startAuto();
  }

  function bindCountriesCarousel() {
    var el = document.querySelector(".countries-carousel");
    if (!el) return;
    var viewport = el.querySelector(".countries-carousel-viewport");
    var track = el.querySelector(".countries-carousel-track");
    var caps = el.querySelectorAll(".countries-carousel-caption");
    var reals = Array.prototype.slice.call(track.children);
    var total = reals.length;
    if (!total) return;

    // Clone two slides onto each end so the loop never shows a blank peek,
    // even mid-transition onto an edge clone.
    var base = 0;
    if (total >= 2) {
      var lead1 = reals[total - 2].cloneNode(true);
      var lead2 = reals[total - 1].cloneNode(true);
      var tail1 = reals[0].cloneNode(true);
      var tail2 = reals[1].cloneNode(true);
      [lead1, lead2, tail1, tail2].forEach(function(c) { c.classList.remove("is-active"); });
      track.appendChild(tail1);
      track.appendChild(tail2);
      track.insertBefore(lead2, track.firstChild);
      track.insertBefore(lead1, track.firstChild);
      base = 2;
    }
    var items = Array.prototype.slice.call(track.children);
    var pos = base;
    var realIndex = 0;
    var animating = false;

    function center() {
      var node = items[pos];
      if (!node) return;
      var offset = node.offsetLeft + node.offsetWidth / 2 - viewport.clientWidth / 2;
      track.style.transform = "translateX(" + -offset + "px)";
    }
    function setActive() {
      items.forEach(function(it, i) { it.classList.toggle("is-active", i === pos); });
      caps.forEach(function(c, i) { c.classList.toggle("is-active", i === realIndex); });
    }
    function jump(p) {
      pos = p;
      setActive();
      track.style.transition = "none";
      center();
      // Force a synchronous reflow so the no-transition reposition is committed
      // before re-enabling the transition. Without this the transform reset gets
      // batched with the re-enable and the browser animates it — producing a
      // visible "sweep" when wrapping past the first/last slide.
      void track.offsetWidth;
      track.style.transition = "";
    }
    function slide(p, ri) {
      if (animating) return;
      pos = p;
      realIndex = ri;
      setActive();
      track.style.transition = "";
      center();
      if (total >= 2) animating = true;
    }
    function go(dir) {
      slide(pos + dir, (realIndex + dir + total) % total);
    }

    jump(pos);
    el.querySelector(".countries-carousel-arrow--prev").addEventListener("click", function() { go(-1); });
    el.querySelector(".countries-carousel-arrow--next").addEventListener("click", function() { go(1); });
    track.addEventListener("transitionend", function(e) {
      if (e.target !== track || e.propertyName !== "transform") return;
      animating = false;
      if (total < 2) return;
      if (pos >= base + total) jump(pos - total);
      else if (pos < base) jump(pos + total);
    });
    window.addEventListener("resize", function() { jump(pos); });
    window.addEventListener("load", function() { jump(pos); });
  }

  function bindAccordions() {
    const triggers = document.querySelectorAll(".accordion-trigger");
    triggers.forEach(trigger => {
      trigger.addEventListener("click", () => {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";
        trigger.setAttribute("aria-expanded", !isOpen);
        const item = trigger.closest(".accordion-item");
        if (item) item.classList.toggle("is-open", !isOpen);
      });
    });
  }

  function bindTextbookSliders() {
    document.querySelectorAll(".textbook-row").forEach(function (row) {
      var track = row.querySelector(".textbook-track");
      if (!track) return;
      var prev = row.querySelector(".textbook-arrow--prev");
      var next = row.querySelector(".textbook-arrow--next");

      function step() {
        var card = track.querySelector(".textbook-card");
        if (!card) return track.clientWidth * 0.8;
        var styles = getComputedStyle(track);
        var gap = parseFloat(styles.columnGap || styles.gap) || 0;
        var cardW = card.offsetWidth + gap;
        var per = Math.max(1, Math.floor(track.clientWidth / cardW));
        return cardW * per;
      }
      function update() {
        var maxScroll = track.scrollWidth - track.clientWidth;
        var overflow = maxScroll > 1;
        row.classList.toggle("has-overflow", overflow);
        if (prev) prev.disabled = !overflow || track.scrollLeft <= 1;
        if (next) next.disabled = !overflow || track.scrollLeft >= maxScroll - 1;
      }

      if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
      if (next) next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
      track.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);

      update();
      window.requestAnimationFrame(update);
      window.setTimeout(update, 300);
    });
  }

  function bindParallaxStats() {
    const bg = document.querySelector(".parallax-stats-bg");
    const section = document.querySelector(".parallax-stats-section");
    if (!bg || !section) return;
    if (window.matchMedia("(max-width: 1024px)").matches) return;

    let inView = false;
    let ticking = false;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          inView = e.isIntersecting;
        });
      },
      { rootMargin: "100px 0px 100px 0px" }
    );
    io.observe(section);

    function update() {
      ticking = false;
      if (!inView) return;
      const rect = section.getBoundingClientRect();
      const centerOffset = rect.top + rect.height / 2 - window.innerHeight / 2;
      const offset = -centerOffset * 0.3;
      bg.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  let inquiryEscHandler = null;
  function bindInquiryModal() {
    const stale = document.getElementById("inquiry-modal");
    if (stale) stale.remove();
    if (inquiryEscHandler) {
      document.removeEventListener("keydown", inquiryEscHandler);
      inquiryEscHandler = null;
    }
    const openers = Array.from(document.querySelectorAll("[data-open-inquiry]"));
    if (!openers.length) return;

    document.body.insertAdjacentHTML("beforeend", inquiryModalMarkup());
    const modal = document.getElementById("inquiry-modal");
    bindForm();

    function openModal(event) {
      if (event) event.preventDefault();
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add("is-open"));
      document.body.classList.add("inquiry-open");
      const firstField = modal.querySelector("input, select, textarea");
      if (firstField) firstField.focus();
    }
    function closeModal() {
      modal.classList.remove("is-open");
      document.body.classList.remove("inquiry-open");
      window.setTimeout(() => { modal.hidden = true; }, 250);
    }
    openers.forEach((btn) => btn.addEventListener("click", openModal));
    modal.querySelectorAll("[data-close-inquiry]").forEach((el) => el.addEventListener("click", closeModal));
    inquiryEscHandler = function (event) {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    };
    document.addEventListener("keydown", inquiryEscHandler);
  }

  // 低清占位（LQIP）：在大图下载完成前，用同名 .lqip.jpg 的 32px 模糊小图铺底，
  // 避免空白等待；大图加载完成后移除背景，防止透出（如 object-fit: contain 场景）。
  function applyImagePlaceholders() {
    const imgs = root.querySelectorAll('img[src*="/img/"], img[src*="/assets/"]');
    imgs.forEach((img) => {
      if (img.dataset.lqipApplied) return;
      img.dataset.lqipApplied = "1";
      const src = img.getAttribute("src") || "";
      const match = src.match(/^(.*)\.(jpe?g|png)(\?.*)?$/i);
      if (!match) return;
      if (img.complete && img.naturalWidth > 0) return;
      img.style.backgroundImage = `url('${match[1]}.lqip.jpg')`;
      img.style.backgroundSize = "cover";
      img.style.backgroundPosition = "center";
      img.style.backgroundRepeat = "no-repeat";
      const clearPlaceholder = () => {
        img.style.backgroundImage = "";
        img.style.backgroundSize = "";
        img.style.backgroundPosition = "";
        img.style.backgroundRepeat = "";
      };
      img.addEventListener("load", clearPlaceholder, { once: true });
      img.addEventListener("error", clearPlaceholder, { once: true });
    });
  }

  function render() {
    applyBrandTheme();
    updateHeadMeta();
    updateAccessibilityCopy();
    safeStorageSet("wmoi-lang", currentLang);
    document.body.classList.toggle("home-page", currentPage === "home");
    renderHeader();
    root.innerHTML = renderers[currentPage] ? renderers[currentPage]() : renderHome();
    applyImagePlaceholders();
    renderFooter();
    bindForm();
    bindRevealMotion();
    bindCountMotion();
    bindParallaxStats();
    bindTrustCarousel();
    bindTrustVideo();
    bindHomeCarousel();
    bindNewsHeroCarousel();
    bindAssessmentTabs();
    bindCountriesCarousel();
    bindTextbookSliders();
    bindAccordions();

    bindInquiryModal();
  }

  // 跨页预取：当前页（含图片懒加载之外的全部元素）加载完成后，
  // 空闲时把其余页面的 HTML 预取进缓存。切页时文档即取即用、JS/CSS 复用缓存，
  // 避免每次切页都等一轮跨境往返造成白屏。媒体仍按需懒加载，不受预取影响。
  function prefetchSiblingPages() {
    const pages = ["index.html", "about.html", "trust.html", "news.html", "contact.html"];
    const current = location.pathname.split("/").pop() || "index.html";
    pages.forEach((p) => {
      if (p === current) return;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = "./" + p;
      link.as = "document";
      document.head.appendChild(link);
    });
  }
  window.addEventListener("load", () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(prefetchSiblingPages);
  });

  render();
})();
