(function () {
  "use strict";

  // Namespace tunggal untuk semua fitur aplikasi.
  const App = window.App = {};
  const D = window.DATA_MATERI;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem("globe:" + key); return v === null ? fallback : v; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem("globe:" + key, String(value)); } catch (_) {} },
    json(key, fallback) { try { return JSON.parse(localStorage.getItem("globe:" + key) || "null") || fallback; } catch (_) { return fallback; } }
  };
  if (!D) {
    document.addEventListener("DOMContentLoaded", () => {
      const area = $("#globe-container");
      if (area) area.innerHTML = "<p class='material-card'>Data materi belum dimuat. Pastikan data-materi.js ada di folder yang sama.</p>";
    });
    return;
  }

  App.state = {
    tab: "tujuan", material: "Konsep Dasar", globe: null, geoFeatures: [],
    geoFallback: false, layers: { biomes: true, fauna: true, lines: true, flora: false, conservation: false, insects: false },
    night: false, autoRotate: !reducedMotion, quiz: null, specimen: null, guideTimer: null,
    passport: store.json("passport", { biomes: [], fauna: [], zones: [], conservation: [] }),
    best: Number(store.get("best-score", "0")) || 0
  };

  const materialNames = ["Konsep Dasar", "8 Bioma", "8 Wilayah Fauna Dunia (Wallace)", "Garis Wallace dan Weber", "Flora dan Fauna Indonesia", "Faktor Sebaran", "Konservasi"];

  // Membuat lencana sumber yang membedakan buku dan pengayaan.
  App.badge = function (source, page) {
    const extra = source === "pengayaan";
    const text = extra ? "Pengayaan · di luar buku" : "Buku" + (page ? " hlm. " + page : "");
    return `<span class="source-badge ${extra ? "enrichment" : "book"}">${extra ? "✨" : "📖"} ${esc(text)}</span>`;
  };

  // Mengganti panel aplikasi sekaligus memperbarui navigasi keyboard.
  App.showTab = function (name) {
    App.state.tab = name;
    $$(".tab-btn").forEach((b, i, arr) => {
      const active = b.dataset.tab === name;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    $$(".tab-panel").forEach(p => {
      const active = p.id === "tab-" + name;
      p.hidden = !active;
      p.classList.toggle("active", active);
    });
    if (name === "lkpd" && typeof window.renderLKPD === "function") window.renderLKPD();
    if (name === "globe" && App.state.globe) setTimeout(() => App.state.globe.width($("#globe-stage").clientWidth), 50);
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  // Mencari koordinat pertama yang cocok dengan sebuah entri.
  App.locationFor = function (item) {
    if (item && item.lokasi && item.lokasi[0]) return { lat: item.lokasi[0].lat, lng: item.lokasi[0].lng };
    if (item && item.pusat) return item.pusat;
    return { lat: -2, lng: 118 };
  };

  // Menerbangkan kamera globe ke koordinat pilihan.
  App.terbang = function (lat, lng, altitude, ms) {
    App.showTab("globe");
    if (App.state.globe) App.state.globe.pointOfView({ lat: Number(lat), lng: Number(lng), altitude: altitude || 1.2 }, ms == null ? 1800 : ms);
  };

  // Menyiapkan tujuan belajar dan misi sampul.
  App.renderObjectives = function () {
    $("#objectives").innerHTML = D.tujuanPembelajaran.map((x, i) => `
      <article class="info-card"><span class="card-kicker">MISI ${String(i + 1).padStart(2, "0")}</span>
      <span class="level-badge">${esc(x.c)}</span><h3>${esc(x.teks)}</h3>
      <p><strong>Intinya:</strong> satu langkah kecil membawamu lebih dekat menjadi ahli biogeografi.</p></article>`).join("");
  };

  // Merender pilihan dan isi submateri dari data utama.
  App.renderMaterials = function () {
    $("#material-nav").innerHTML = materialNames.map(n => `<button class="${App.state.material === n ? "active" : ""}" data-material="${esc(n)}">${esc(n)}</button>`).join("");
    const target = $("#material-content");
    const pageButton = (lat, lng) => `<button class="small-btn" data-action="fly" data-lat="${lat}" data-lng="${lng}">🌍 Lihat di Globe</button>`;
    const species = (arr, lat, lng) => `<div class="chip-list">${(arr || []).map(s => `<span class="chip">${esc(s.emoji)} ${esc(s.nama)} ${App.badge(s.sumber, "")}</span>`).join("")}</div>`;
    const card = (title, page, body, lat, lng) => `<article class="material-card"><span class="card-kicker">📍 ${esc(page || "")}</span><h3>${esc(title)}</h3>${body}<p>${pageButton(lat == null ? -2 : lat, lng == null ? 118 : lng)}</p><p><strong>Intinya:</strong> amati hubungan tempat, iklim, dan kehidupan.</p></article>`;
    let html = "";
    switch (App.state.material) {
      case "Konsep Dasar":
        html = `<h2>Konsep Dasar</h2>${D.konsepDasar.map(x => card(x.istilah, "Buku hlm. " + x.hlm, `<p>${esc(x.arti)}</p>`, -2, 118)).join("")}
          <div class="material-card"><h3>Fakta cepat</h3><p>${esc(D.bioma[Math.floor(Math.random() * D.bioma.length)].fakta)}</p><strong>Intinya:</strong> fakta menjadi pintu masuk untuk bertanya lebih jauh.</div>`;
        break;
      case "8 Bioma":
        html = `<h2>Delapan bioma dunia</h2><p>Bioma adalah wilayah luas dengan iklim serta komunitas makhluk hidup yang khas.</p>
          <div class="material-tools"><label>Urutkan tabel <select id="biome-sort"><option value="nama">Nama</option><option value="iklim">Iklim</option><option value="flora">Flora</option><option value="fauna">Fauna</option></select></label></div>
          <div id="biome-table" class="table-wrap"></div>${D.bioma.map(b => card(b.emoji + " " + b.nama, "Buku hlm. " + b.hlm, `<p>${esc(b.ringkas)}</p><p><b>Iklim:</b> ${esc(b.iklim.suhu)} · ${esc(b.iklim.hujan)} · ${esc(b.iklim.musim)}</p><p><b>Flora khas:</b> ${b.flora.map(x => esc(x.nama)).join(", ")}</p><p><b>Fauna khas:</b> ${b.fauna.map(x => esc(x.nama)).join(", ")}</p>`, b.lokasi[0].lat, b.lokasi[0].lng)).join("")}`;
        break;
      case "8 Wilayah Fauna Dunia (Wallace)":
        html = `<h2>Wilayah fauna dunia menurut Wallace</h2>${D.wilayahFauna.map(w => card(w.emoji + " " + w.nama, "Buku hlm. " + w.hlm, `<p>${esc(w.cakupan)}</p><p><b>Fauna khas:</b> ${w.fauna.map(x => esc(x.nama)).join(", ")}</p>`, w.pusat.lat, w.pusat.lng)).join("")}`;
        break;
      case "Garis Wallace dan Weber":
        html = `<h2>Dua garis, tiga zona Indonesia</h2>${["wallace","weber"].map(k => { const g = D.garis[k]; return card(g.nama, "Buku hlm. " + g.hlm, `<p><b>Tokoh:</b> ${esc(g.tokoh)}</p><p>${esc(g.fungsi)}</p><p>${esc(g.catatan)}</p>`, -3, 120); }).join("")}
          <div class="material-card"><h3>🌐 Tiga zona Indonesia</h3>${D.faunaIndonesia.map(f => `<p><b>${esc(f.nama)}:</b> ${esc(f.cakupan)}</p>`).join("")}<strong>Intinya:</strong> garis membantu menjelaskan peralihan corak fauna.</div>`;
        break;
      case "Flora dan Fauna Indonesia":
        html = `<h2>Flora dan fauna Indonesia</h2>${D.floraIndonesia.wilayah.map(w => card(w.emoji + " " + w.nama, "Buku hlm. " + w.hlm, `<p>${esc(w.vegetasi)}</p><p>${esc(w.iklim)}</p>${species(w.flora)}`, w.pusat.lat, w.pusat.lng)).join("")}
          ${D.faunaIndonesia.map(f => card(f.emoji + " " + f.nama, "Buku hlm. " + f.hlm, `<p>${esc(f.cakupan)}</p><p><b>Fauna unggulan:</b> ${f.unggulan.map(x => esc(x.nama)).join(", ")}</p>`, f.pusat.lat, f.pusat.lng)).join("")}
          <h3>Statistik flora dan fauna</h3><div id="stats-chart"></div>`;
        break;
      case "Faktor Sebaran":
        html = `<h2>Apa yang memengaruhi persebaran?</h2>${D.faktor.map(f => card(f.emoji + " " + f.nama, "Buku hlm. " + f.hlm, f.isi.map(y => `<p><b>${esc(y.sub)}:</b> ${esc(y.teks)}</p>`).join(""), -2, 118)).join("")}`;
        break;
      case "Konservasi":
        html = `<h2>Menjaga kehidupan, menjaga masa depan</h2><article class="material-card"><p><b>In situ:</b> ${esc(D.konservasi.inSitu)} <b>Ex situ:</b> ${esc(D.konservasi.exSitu)}</p><p>${D.konservasi.tujuan.map(esc).join(" · ")}</p></article>
          ${D.konservasi.kawasan.map(k => card(k.n, "Buku hlm. " + k.hlm, `<p>${esc(k.jenis)} · ${esc(k.metode)}</p>`, k.lat, k.lng)).join("")}`;
        break;
    }
    target.innerHTML = html;
    const sort = $("#biome-sort");
    if (sort) {
      const draw = key => {
        const list = D.bioma.slice().sort((a, b) => String(key === "nama" ? a.nama : key === "iklim" ? a.iklim.hujan : key === "flora" ? a.flora[0].nama : a.fauna[0].nama).localeCompare(String(key === "nama" ? b.nama : key === "iklim" ? b.iklim.hujan : key === "flora" ? b.flora[0].nama : b.fauna[0].nama), "id"));
        $("#biome-table").innerHTML = `<table><thead><tr><th>Bioma</th><th>Iklim</th><th>Flora</th><th>Fauna</th></tr></thead><tbody>${list.map(b => `<tr><td>${esc(b.nama)}</td><td>${esc(b.iklim.hujan)}</td><td>${esc(b.flora[0].nama)}</td><td>${esc(b.fauna[0].nama)}</td></tr>`).join("")}</tbody></table>`;
      };
      draw("nama"); sort.addEventListener("change", () => draw(sort.value));
    }
    const stats = $("#stats-chart");
    if (stats) stats.innerHTML = [...D.statistik.flora.map(x => ["Flora · " + x[0], x[1]]), ...D.statistik.fauna.map(x => ["Fauna · " + x[0], x[1]])].map(x => `<div class="bar-row"><span>${esc(x[0])}</span><div class="bar-track"><i style="width:${Math.max(4, Math.log10(x[1] + 1) / 5.4 * 100)}%"></i></div><b>${Number(x[1]).toLocaleString("id-ID")}</b></div>`).join("");
  };

  // Mengumpulkan marker dengan sumber dan kategori untuk globe.
  App.makeMarkers = function (altitude) {
    const out = [];
    const push = (lat, lng, emoji, label, type, data, color) => out.push({ lat, lng, emoji, label, type, data, color });
    if (altitude > 1.8) {
      D.wilayahFauna.forEach(w => push(w.pusat.lat, w.pusat.lng, w.emoji, w.nama, "fauna", w, w.warna));
      return out;
    }
    if (App.state.layers.biomes) D.bioma.forEach(b => b.lokasi.forEach(l => push(l.lat, l.lng, b.emoji, l.n, "biome", b, b.warna)));
    if (altitude < .7) {
      if (App.state.layers.biomes) D.bioma.forEach(b => {
        const l = b.lokasi[0];
        [...b.flora, ...b.fauna, ...b.serangga].forEach((s, i) => {
          const angle = i * 2.399, radius = .14 + (i % 3) * .04;
          push(l.lat + Math.sin(angle) * radius, l.lng + Math.cos(angle) * radius, s.emoji, s.nama, "species", { species: s, biome: b }, b.warna);
        });
      });
    }
    if (App.state.layers.fauna) D.wilayahFauna.forEach(w => push(w.pusat.lat, w.pusat.lng, w.emoji, w.nama, "fauna", w, w.warna));
    if (App.state.layers.flora) D.floraIndonesia.wilayah.forEach(w => push(w.pusat.lat, w.pusat.lng, w.emoji, w.nama, "flora-region", w, w.warna));
    if (App.state.layers.conservation) D.konservasi.kawasan.forEach(k => push(k.lat, k.lng, k.metode === "in situ" ? "🛡️" : "🌱", k.n, "conservation", k, k.metode === "in situ" ? "#41d6a5" : "#ffd166"));
    if (App.state.layers.insects) {
      D.bioma.forEach(b => b.serangga.forEach((s, i) => { const l = b.lokasi[0]; push(l.lat + i * .12, l.lng + i * .12, s.emoji, s.nama, "species", { species: s, biome: b }, b.warna); }));
      D.wilayahFauna.forEach(w => w.serangga.forEach((s, i) => push(w.pusat.lat + i * .1, w.pusat.lng + i * .1, s.emoji, s.nama, "species", { species: s, fauna: w }, w.warna)));
    }
    return out.slice(0, 120);
  };

  // Menggambar lapisan, GeoJSON, marker HTML dan fallback ring.
  App.refreshGlobe = function () {
    const g = App.state.globe;
    if (!g) return;
    const altitude = g.pointOfView().altitude || 2;
    const markerData = App.makeMarkers(altitude);
    g.htmlElementsData(markerData)
      .htmlLat(d => d.lat).htmlLng(d => d.lng)
      .htmlElement(d => {
        const el = document.createElement("button");
        el.className = "globe-marker"; el.type = "button";
        el.style.backgroundColor = (d.color || "#237c85") + "dd";
        el.textContent = d.emoji; el.title = d.label; el.setAttribute("aria-label", "Buka " + d.label);
        el.addEventListener("click", e => { e.stopPropagation(); App.openCard(d); });
        return el;
      });
    const features = App.state.geoFeatures;
    if (App.state.layers.fauna && features.length) {
      const codeToRegion = new Map();
      D.wilayahFauna.forEach(w => w.negara.forEach(code => codeToRegion.set(code, w)));
      const selected = features.filter(f => codeToRegion.has((f.properties.ISO_A3 === "-99" ? f.properties.ADM0_A3 : f.properties.ISO_A3)));
      g.polygonsData(selected)
        .polygonCapColor(f => (codeToRegion.get(f.properties.ISO_A3 === "-99" ? f.properties.ADM0_A3 : f.properties.ISO_A3).warna || "#22aa99") + "75")
        .polygonSideColor(() => "rgba(70,160,190,.18)")
        .polygonStrokeColor(f => codeToRegion.get(f.properties.ISO_A3 === "-99" ? f.properties.ADM0_A3 : f.properties.ISO_A3).warna || "#77dddd")
        .polygonAltitude(.008).polygonLabel(f => {
          const w = codeToRegion.get(f.properties.ISO_A3 === "-99" ? f.properties.ADM0_A3 : f.properties.ISO_A3);
          return `<div class="globe-label">${esc(w.nama)}</div>`;
        });
    } else g.polygonsData([]);
    if (App.state.layers.lines) {
      const paths = [
        { name: D.garis.wallace.nama, color: D.garis.wallace.warna, coords: D.garis.wallace.jalur.map(x => ({ lat: x[0], lng: x[1] })) },
        { name: D.garis.weber.nama, color: D.garis.weber.warna, coords: D.garis.weber.jalur.map(x => ({ lat: x[0], lng: x[1] })) }
      ];
      g.pathsData(paths).pathPoints(d => d.coords).pathPointLat(p => p.lat).pathPointLng(p => p.lng)
        .pathColor(d => d.color).pathStroke(1.5).pathDashLength(.35).pathDashGap(.15).pathDashAnimateTime(4000);
      g.ringsData(D.faunaIndonesia.map((f, i) => ({ lat: f.pusat.lat, lng: f.pusat.lng, color: ["#44c4ff", "#ffba55", "#db65ff"][i], maxR: 4.5 })))
        .ringLat(d => d.lat).ringLng(d => d.lng).ringColor(d => d.color).ringMaxRadius(d => d.maxR).ringPropagationSpeed(1).ringRepeatPeriod(1400);
    } else { g.pathsData([]); g.ringsData([]); }
  };

  // Mencatat kunjungan dan membuka kartu informasi yang sesuai.
  App.visit = function (type, data) {
    const p = App.state.passport;
    let key = null;
    if (type === "biome") { key = "biomes"; if (!p[key].includes(data.id)) p[key].push(data.id); }
    if (type === "fauna") { key = "fauna"; if (!p[key].includes(data.id)) p[key].push(data.id); }
    if (type === "flora-region") { key = "zones"; if (!p[key].includes(data.id)) p[key].push(data.id); }
    if (type === "conservation") { key = "conservation"; if (!p[key].includes(data.n)) p[key].push(data.n); }
    store.set("passport", JSON.stringify(p)); App.updatePassport();
  };

  // Membuat kartu bioma, wilayah, konservasi, atau spesies.
  App.openCard = function (item) {
    App.visit(item.type, item.data);
    const box = $("#info-content");
    if (item.type === "species") { App.openSpecies(item.data.species, item.data.biome || item.data.fauna); return; }
    let d = item.data, title = d.nama || d.n || item.label, page = d.hlm || "";
    let body = "";
    if (item.type === "biome") {
      body = `<p>${esc(d.ringkas)}</p><p><b>Iklim</b><br>🌡️ ${esc(d.iklim.suhu)}<br>🌧️ ${esc(d.iklim.hujan)}<br>🗓️ ${esc(d.iklim.musim)}</p>
      <h3>Ciri khas</h3><ul>${d.ciri.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h3>🌿 Flora</h3>${App.speciesChips(d.flora,d)}<h3>🐾 Fauna</h3>${App.speciesChips(d.fauna,d)}<h3>🦋 Serangga</h3>${App.speciesChips(d.serangga,d)}
      <p><b>Adaptasi:</b> ${esc(d.adaptasi)}</p><p><b>Budaya:</b> ${esc(d.budaya)}</p><p><b>Persebaran:</b> ${esc(d.persebaran)}</p><p><b>Fakta:</b> ${esc(d.fakta)}</p>`;
    } else if (item.type === "fauna") {
      body = `<p>${esc(d.cakupan)}</p><h3>Fauna khas</h3>${App.speciesChips(d.fauna,d)}<h3>Serangga</h3>${App.speciesChips(d.serangga,d)}<p>${esc(d.catatan)}</p>`;
    } else if (item.type === "flora-region") {
      body = `<p>${esc(d.iklim)}</p><p>${esc(d.vegetasi)}</p><h3>Flora khas</h3>${App.speciesChips(d.flora,d)}`;
    } else if (item.type === "conservation") {
      body = `<p>${esc(d.jenis)} · metode ${esc(d.metode)}.</p><p>Kawasan konservasi membantu melindungi habitat dan kehidupan di dalamnya.</p>`;
    }
    box.innerHTML = `<div class="card-kicker">${item.type === "biome" ? "BIOMA" : item.type === "fauna" ? "WILAYAH FAUNA" : item.type === "conservation" ? "KAWASAN KONSERVASI" : "FLORA INDONESIA"}</div><h2>${esc(item.emoji)} ${esc(title)}</h2>${page ? App.badge("buku", page) : App.badge("pengayaan")}
      ${body}<p><button class="primary-btn" data-action="stamp" data-id="${esc(d.id || title)}">🛂 Cap Paspor</button></p><p><strong>Intinya:</strong> setiap wilayah punya cerita kehidupan yang unik.</p>`;
    $("#info-drawer").classList.add("open");
  };

  // Membuat chip spesies yang membuka kartu spesies.
  App.speciesChips = function (list, parent) {
    return `<div class="chip-list">${(list || []).map((s, i) => `<button class="chip species-chip" data-action="species" data-parent="${esc(parent.id || parent.nama || "")}" data-index="${i}" data-name="${esc(s.nama)}">${esc(s.emoji)} ${esc(s.nama)}</button>`).join("")}</div>`;
  };

  // Membuka kartu spesies dengan sumber dan akses ke model 3D.
  App.openSpecies = function (s, parent) {
    if (!s) return;
    $("#info-content").innerHTML = `<div class="card-kicker">KARTU SPESIES</div><div style="font-size:3rem">${esc(s.emoji)}</div><h2>${esc(s.nama)}</h2><p><i>${esc(s.latin)}</i></p><p>${esc(s.ket)}</p>${App.badge(s.sumber, parent && parent.hlm)}
      ${s.model ? `<p><button class="primary-btn specimen-button" data-action="open-specimen" data-model="${esc(s.model)}" data-name="${esc(s.nama)}" data-emoji="${esc(s.emoji)}" data-fact="${esc(s.ket)}">✨ Lihat 3D</button></p>` : ""}
      <p><strong>Intinya:</strong> memahami satu spesies membantu kita memahami ekosistemnya.</p>`;
    $("#info-drawer").classList.add("open");
  };

  // Memuat GeoJSON dengan URL cadangan dan fallback tanpa kesalahan console.
  App.loadGeoJSON = async function () {
    const urls = [
      "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson",
      "https://cdn.jsdelivr.net/gh/vasturiano/globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson"
    ];
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const json = await response.json();
        if (json && Array.isArray(json.features)) { App.state.geoFeatures = json.features; break; }
      } catch (_) { /* Fallback rings dan label tetap digunakan. */ }
    }
    if (!App.state.geoFeatures.length) App.state.geoFallback = true;
    App.refreshGlobe();
  };

  // Membuat globe dan mengatur kamera serta teksturnya.
  App.initGlobe = function () {
    const host = $("#globe-container");
    if (typeof window.Globe !== "function") {
      $("#globe-loader").innerHTML = `<strong>Globe belum dapat dimuat.</strong><small>Periksa koneksi internet, lalu coba lagi.</small><button class="primary-btn" data-action="reload">Muat Ulang</button>`;
      return;
    }
    try {
      const g = window.Globe()(host)
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
        .showAtmosphere(true).atmosphereColor("#55cfff").atmosphereAltitude(.18)
        .width($("#globe-stage").clientWidth).height($("#globe-stage").clientHeight);
      App.state.globe = g;
      const controls = g.controls();
      controls.enableDamping = true; controls.dampingFactor = .08;
      controls.minDistance = 115; controls.maxDistance = 520;
      controls.autoRotate = App.state.autoRotate; controls.autoRotateSpeed = .35;
      g.pointOfView({ lat: 10, lng: 0, altitude: 5 }, 0);
      setTimeout(() => {
        const loader = $("#globe-loader"); loader.style.opacity = "0";
        setTimeout(() => { loader.hidden = true; }, 450);
        g.pointOfView({ lat: -2, lng: 118, altitude: 1.7 }, reducedMotion ? 0 : 3600);
      }, 500);
      App.refreshGlobe(); App.loadGeoJSON();
      let timer = 0;
      controls.addEventListener("change", () => {
        if (timer) return;
        timer = setTimeout(() => { timer = 0; App.refreshGlobe(); }, 350);
      });
      window.addEventListener("resize", () => g.width($("#globe-stage").clientWidth).height($("#globe-stage").clientHeight));
    } catch (_) {
      $("#globe-loader").innerHTML = `<strong>Globe mengalami kendala saat disiapkan.</strong><small>Bagian materi dan kuis tetap bisa digunakan.</small><button class="primary-btn" data-action="reload">Muat Ulang</button>`;
    }
  };

  // Membuat perbandingan bioma berdampingan.
  App.setupCompare = function () {
    const select = n => `<select aria-label="Pilih bioma ${n}" id="compare-${n}">${D.bioma.map(b => `<option value="${esc(b.id)}">${esc(b.nama)}</option>`).join("")}</select>`;
    $("#compare-controls").innerHTML = `<div>${select("a")} ${select("b")} <button class="small-btn" data-action="compare">Bandingkan</button></div>`;
  };
  App.compare = function () {
    const a = D.bioma.find(x => x.id === $("#compare-a").value), b = D.bioma.find(x => x.id === $("#compare-b").value);
    const fields = [["Iklim", x => x.iklim.hujan], ["Flora", x => x.flora.map(s => s.nama).join(", ")], ["Fauna", x => x.fauna.map(s => s.nama).join(", ")], ["Adaptasi", x => x.adaptasi]];
    $("#compare-result").innerHTML = `<div class="table-wrap"><table><tr><th>${esc(a.nama)}</th><th>${esc(b.nama)}</th></tr>${fields.map(([n, f]) => `<tr><td><b>${n}:</b> ${esc(f(a))}</td><td><b>${n}:</b> ${esc(f(b))}</td></tr>`).join("")}</table></div>`;
  };

  // Memperbarui XP, peringkat, progres dan lencana penjelajah.
  App.updatePassport = function () {
    const p = App.state.passport, n = p.biomes.length + p.fauna.length + p.zones.length + p.conservation.length;
    const total = 24, xp = n * 25;
    const rank = xp >= 450 ? "Duta Konservasi" : xp >= 300 ? "Ahli Biogeografi" : xp >= 150 ? "Penjelajah Muda" : "Penjelajah Pemula";
    $("#passport-summary").textContent = `${p.biomes.length}/8 bioma · ${p.fauna.length}/8 fauna · ${p.zones.length}/3 zona · ${p.conservation.length}/5 konservasi`;
    $("#rank-label").textContent = rank; $("#xp-label").textContent = xp + " XP";
    $("#passport-progress").style.width = Math.min(100, n / total * 100) + "%";
    if (p.biomes.length >= 8 && p.fauna.length >= 8 && p.zones.length >= 3 && p.conservation.length >= 5 && !store.get("badge-earned", "")) {
      store.set("badge-earned", "yes"); App.confetti();
    }
  };

  // Menampilkan konfeti ringan saat semua kategori paspor terpenuhi.
  App.confetti = function () {
    if (reducedMotion) return;
    const canvas = $("#confetti-canvas"), ctx = canvas.getContext("2d");
    canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
    const bits = Array.from({ length: 90 }, () => ({ x: Math.random() * canvas.width, y: -Math.random() * canvas.height, v: 2 + Math.random() * 5, c: ["#58dfcc", "#ffd166", "#ff7d9d"][Math.floor(Math.random() * 3)] }));
    let frames = 0;
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bits.forEach(b => { b.y += b.v * devicePixelRatio; ctx.fillStyle = b.c; ctx.fillRect(b.x, b.y, 7, 11); });
      if (++frames < 100) requestAnimationFrame(draw); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  };

  // Mengatur pemandu Kak Geo dan petunjuk bergantian.
  App.startGuide = function () {
    const tips = ["Coba cari 'tundra' atau 'komodo' di kotak pencarian.", "Tahukah kamu? Setiap bioma punya cara unik untuk menghadapi iklim.", "Klik kartu spesies untuk membuka Lab Spesimen 3D.", "Kunjungi kawasan konservasi untuk menambah cap paspormu."];
    let i = 0;
    App.state.guideTimer = setInterval(() => { const el = $("#guide-text"); if (el) el.textContent = tips[i++ % tips.length]; }, 9000);
  };

  // Menampilkan infografis skor terbaik.
  App.updateBest = function () {
    $("#best-score").textContent = "Skor terbaik: " + (App.state.best ? App.state.best + "%" : "belum ada");
  };

  // Mengacak array tanpa mengubah array sumber.
  App.shuffle = function (arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };

  // Memulai mode cepat atau lengkap dan mengacak opsi berdasarkan teks jawaban.
  App.startQuiz = function (mode) {
    let questions = D.kuis.slice();
    if (mode === "quick") {
      const levels = ["C1", "C2", "C3", "C4", "C5"], chosen = [];
      levels.forEach(level => chosen.push(...App.shuffle(questions.filter(q => q.c === level)).slice(0, 2)));
      questions = App.shuffle(chosen).slice(0, 10);
    }
    App.state.quiz = { questions: questions.map(q => {
      const correct = q.o[q.a];
      return { ...q, options: App.shuffle(q.o), answerText: correct };
    }), index: 0, correct: 0, wrong: [], topics: {} };
    App.renderQuizQuestion();
  };

  // Merender satu soal, menerima jawaban klik atau papan ketik.
  App.renderQuizQuestion = function () {
    const qz = App.state.quiz;
    if (!qz) return;
    if (qz.index >= qz.questions.length) { App.renderQuizResult(); return; }
    const q = qz.questions[qz.index];
    $("#quiz-area").innerHTML = `<div class="quiz-progress"><i style="width:${qz.index / qz.questions.length * 100}%"></i></div>
      <span class="level-badge">${esc(q.c)}</span> <span class="card-kicker">${esc(q.topik)} · Soal ${qz.index + 1}/${qz.questions.length}</span>
      <h2>${esc(q.q)}</h2><div class="option-list">${q.options.map((o, i) => `<button class="option-btn" data-answer="${i}"><b>${i + 1}.</b> ${esc(o)}</button>`).join("")}</div>
      <div id="quiz-feedback"></div>`;
  };
  App.answerQuiz = function (index) {
    const qz = App.state.quiz, q = qz && qz.questions[qz.index];
    if (!q || q.answered) return;
    q.answered = true;
    const chosen = q.options[index], correct = chosen === q.answerText;
    if (correct) qz.correct++; else qz.wrong.push(q);
    qz.topics[q.topik] = qz.topics[q.topik] || { total: 0, correct: 0 };
    qz.topics[q.topik].total++; if (correct) qz.topics[q.topik].correct++;
    $$(".option-btn").forEach((b, i) => {
      b.disabled = true;
      if (q.options[i] === q.answerText) b.classList.add("correct");
      if (i === index && !correct) b.classList.add("incorrect");
    });
    $("#quiz-feedback").innerHTML = `<div class="feedback"><h3>${correct ? "✅ Tepat!" : "❌ Belum tepat."}</h3><b>Pembahasan:</b> ${esc(q.p)}<p>📖 Rujukan: Buku hlm. ${esc(q.hlm)}</p><button class="primary-btn" data-action="quiz-next">Lanjut →</button></div>`;
    if ($("#sound-toggle").checked) App.playTone(correct);
  };

  // Membunyikan nada sederhana bila pengguna mengaktifkan suara.
  App.playTone = function (correct) {
    try {
      const ctx = new AudioContext(), oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.frequency.value = correct ? 660 : 220; gain.gain.value = .05;
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .13);
      oscillator.onended = () => ctx.close();
    } catch (_) {}
  };

  // Menghitung skor, rekap topik, soal salah, dan opsi pengulangan.
  App.renderQuizResult = function () {
    const qz = App.state.quiz, percent = Math.round(qz.correct / qz.questions.length * 100);
    if (percent > App.state.best) { App.state.best = percent; store.set("best-score", percent); App.updateBest(); }
    const stars = percent >= 85 ? "⭐⭐⭐" : percent >= 60 ? "⭐⭐" : "⭐";
    const msg = percent >= 85 ? "Hebat, kamu siap menjadi pemandu ekspedisi!" : percent >= 60 ? "Bagus! Sedikit lagi kompasmu makin tajam." : "Tidak apa-apa. Penjelajah hebat selalu belajar lagi.";
    const topics = Object.entries(qz.topics).map(([name, v]) => `<div class="bar-row"><span>${esc(name)}</span><div class="bar-track"><i style="width:${v.correct / v.total * 100}%"></i></div><b>${v.correct}/${v.total}</b></div>`).join("");
    const wrong = qz.wrong.map(q => `<article class="wrong-item"><b>${esc(q.q)}</b><p>${esc(q.p)} <small>· Buku hlm. ${esc(q.hlm)}</small></p></article>`).join("") || "<p>Semua jawabanmu benar. Mengesankan!</p>";
    $("#quiz-area").innerHTML = `<div class="quiz-result"><div class="score-number">${percent}%</div><div>${stars}</div><h2>${msg}</h2><p>${qz.correct} dari ${qz.questions.length} jawaban benar</p></div>
      <h3>Rekap per topik</h3>${topics}<h3>Yuk, pelajari lagi</h3>${wrong}
      <div class="button-row"><button class="primary-btn" data-action="quiz-wrong">Ulangi soal yang salah</button><button class="secondary-btn" data-action="quiz-full">Ulangi semua</button><button class="secondary-btn" data-action="weak-globe">Lihat di Globe</button></div>`;
    $("#certificate").dataset.score = String(percent);
    $("#certificate").dataset.rank = percent >= 85 ? "Ahli Biogeografi" : percent >= 60 ? "Penjelajah Muda" : "Penjelajah Pemula";
  };

  // Mengulang soal yang sebelumnya dijawab salah.
  App.retryWrong = function () {
    const qz = App.state.quiz;
    if (!qz || !qz.wrong.length) return;
    App.state.quiz = { questions: qz.wrong.map(q => ({ ...q, options: App.shuffle(q.o), answerText: q.o[q.a] })), index: 0, correct: 0, wrong: [], topics: {} };
    App.renderQuizQuestion();
  };

  // Menyiapkan model prosedural dari bentuk dasar Three.js.
  App.buatModel = function (key) {
    const T = window.THREE, group = new T.Group();
    const mat = (color, roughness = .82) => new T.MeshStandardMaterial({ color, roughness });
    const sphere = (x, y, z, sx, sy, sz, color) => {
      const m = new T.Mesh(new T.SphereGeometry(1, 12, 9), mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); group.add(m); return m;
    };
    const cyl = (x, y, z, r1, r2, h, color, seg = 9) => {
      const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg), mat(color)); m.position.set(x, y, z); group.add(m); return m;
    };
    const cone = (x, y, z, r, h, color) => { const m = new T.Mesh(new T.ConeGeometry(r, h, 8), mat(color)); m.position.set(x, y, z); group.add(m); return m; };
    const box = (x, y, z, sx, sy, sz, color) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat(color)); m.position.set(x, y, z); group.add(m); return m; };
    const colors = { singa: ["#bd7030","#f1bd68"], gajah:["#858e92","#68757b"], jerapah:["#e5a839","#7a4727"], zebra:["#f2f0e9","#171b20"], harimau:["#ed8729","#242020"], orangutan:["#cf692b","#f1ad6d"], komodo:["#71815e","#40523e"], cendrawasih:["#16c9b2","#f1c84b"], kanguru:["#b77949","#7f4e3a"], koala:["#9ca8ac","#e1e5e5"], beruangKutub:["#f4f4e9","#cbd9df"], penguin:["#202833","#f4f4ef"], bison:["#72503a","#3e3029"], unta:["#c99a5c","#875a34"] };
    const c = colors[key] || ["#45b89d","#ecbb56"];
    sphere(0, .45, 0, .72, .53, .42, c[0]);
    sphere(0, 1.05, .13, .43, .43, .38, c[0]);
    sphere(0, .99, .48, .22, .16, .15, c[1]);
    for (let i = 0; i < 4; i++) cyl((i % 2 ? 1 : -1) * .42, .12, i < 2 ? .2 : -.22, .09, .12, .48, c[1], 7);
    if (key === "singa") sphere(0, 1.08, .08, .59, .58, .48, "#70401f");
    if (key === "gajah") { sphere(-.39, 1.04, .1, .32, .42, .12, "#9ca4a7"); const trunk = cyl(0, .65, .56, .12, .16, .64, "#737f84"); trunk.rotation.x = -.3; }
    if (key === "jerapah") { cyl(0, 1.55, .1, .15, .2, 1.15, "#e5a839"); for(let i=0;i<5;i++) sphere((i%2-.5)*.23,.8+(i%3)*.28,.37,.09,.08,.04,"#774725"); }
    if (key === "zebra" || key === "harimau") { for (let i=0;i<5;i++) { const stripe=box(-.48+i*.23,.47,.43,.045,.58,.035,key==="zebra"?"#171b20":"#242020"); stripe.rotation.z=.25; } }
    if (key === "orangutan") { cyl(-.68,.56,.05,.11,.14,.95,"#cf692b"); cyl(.68,.56,.05,.11,.14,.95,"#cf692b"); }
    if (key === "komodo") { sphere(-.55,.28,-.35,.8,.24,.35,"#71815e"); sphere(.85,.28,-.48,.67,.13,.16,"#526446"); }
    if (key === "cendrawasih") { for(let i=0;i<3;i++){const tail=cyl(.1+i*.12,.7,-.5,.025,.035,1.3,["#f2cf45","#15c4b5","#e55d86"][i]);tail.rotation.x=1.1;} }
    if (key === "kanguru") { sphere(0,.35,.53,.28,.25,.1,"#d69c68"); cyl(0,.22,-.8,.13,.18,1.4,"#9c6443").rotation.x=1.1; }
    if (key === "koala") { sphere(-.39,1.11,.07,.28,.31,.16,"#858f94"); sphere(.39,1.11,.07,.28,.31,.16,"#858f94"); }
    if (key === "beruangKutub") group.traverse(o=>{if(o.isMesh)o.material.color.set("#f0eee3");});
    if (key === "penguin") { group.traverse(o=>{if(o.isMesh)o.material.color.set("#242a32");}); sphere(0,.53,.37,.37,.61,.12,"#f7f4e9"); cone(0,1,.55,.13,.24,"#f08b35"); }
    if (key === "bison") sphere(0,.75,.03,.77,.62,.48,"#65442f");
    if (key === "unta") sphere(0,.95,-.1,.23,.38,.2,"#b4834f");
    if (key === "kupu") {
      group.clear(); sphere(0,.45,0,.08,.38,.08,"#342e44");
      const wings=[];
      [-1,1].forEach(side=>[.22,-.22].forEach(y=>{const w=sphere(side*.38,.6+y,0,.4,.29,.06,y>0?"#ed6eaa":"#43c9dc"); wings.push(w);}));
      for(let i=0;i<2;i++){const a=cyl((i?1:-1)*.07,.91,.02,.018,.02,.42,"#342e44");a.rotation.z=(i?1:-1)*.6;}
      group.userData.wings=wings;
    }
    if (key === "semut") { group.clear(); sphere(-.35,.35,0,.22,.21,.2,"#3b2921");sphere(0,.35,0,.17,.16,.17,"#4c3025");sphere(.35,.38,0,.27,.22,.22,"#33231f");for(let i=0;i<6;i++){const leg=cyl((i%2?1:-1)*.2,.23,(Math.floor(i/2)-1)*.18,.025,.025,.48,"#33231f",6);leg.rotation.z=(i%2?-.8:.8);}}
    if (key === "kaktus") { group.clear(); cyl(0,.8,0,.24,.28,1.55,"#25864e");cyl(-.38,.55,0,.12,.15,.65,"#25864e").rotation.z=1.15;cyl(-.63,.8,0,.12,.13,.52,"#25864e");cyl(.38,.72,0,.12,.14,.68,"#25864e").rotation.z=-1.1; }
    if (key === "pinus") { group.clear();cyl(0,.35,0,.11,.14,.7,"#72533c");for(let i=0;i<4;i++)cone(0,.7+i*.28,0,.65-i*.11,.85,"#23734e"); }
    if (key === "jati") { group.clear();cyl(0,.55,0,.15,.2,1.1,"#80613e");sphere(0,1.3,0,.8,.55,.72,"#40804c"); }
    group.userData.animate = true;
    return group;
  };

  // Menghentikan renderer dan membersihkan scene Lab Spesimen.
  App.disposeSpecimen = function () {
    const s = App.state.specimen;
    if (!s) return;
    cancelAnimationFrame(s.frame);
    if (s.controls) s.controls.dispose();
    s.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    s.renderer.dispose(); s.renderer.domElement.remove(); App.state.specimen = null;
  };

  // Membuka modal dan menjalankan scene Three.js r128 yang terpisah.
  App.openSpecimen = function (key, name, emoji, fact) {
    if (!window.THREE || !window.THREE.OrbitControls) {
      $("#specimen-fact").textContent = "Lab 3D belum tersedia. Muat ulang halaman saat koneksi internet aktif.";
      $("#specimen-modal").hidden = false; $("#specimen-emoji").textContent = emoji; return;
    }
    App.disposeSpecimen();
    const modal = $("#specimen-modal"), mount = $("#specimen-canvas");
    modal.hidden = false; mount.innerHTML = ""; $("#specimen-emoji").textContent = "";
    $("#specimen-title").textContent = name; $("#specimen-fact").textContent = fact || "Model ilustrasi edukatif, bukan gambaran ukuran sebenarnya.";
    try {
      const T = window.THREE, w = mount.clientWidth || 600, h = mount.clientHeight || 400;
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, w / h, .1, 100);
      camera.position.set(3.2, 2.4, 4.8);
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h); renderer.outputEncoding = T.sRGBEncoding; mount.appendChild(renderer.domElement);
      scene.add(new T.HemisphereLight(0xc9f3ff, 0x263346, 1.4));
      const light = new T.DirectionalLight(0xffffff, 1.8); light.position.set(3, 5, 4); scene.add(light);
      const ground = new T.Mesh(new T.CircleGeometry(2.1, 48), new T.MeshStandardMaterial({ color: 0x1a4858, roughness: .8 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -.13; scene.add(ground);
      const model = App.buatModel(key); scene.add(model);
      const controls = new T.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = 1;
      const state = { scene, camera, renderer, controls, model, frame: 0 }; App.state.specimen = state;
      const animate = () => {
        if (App.state.specimen !== state) return;
        state.frame = requestAnimationFrame(animate);
        model.position.y = Math.sin(performance.now() * .0014) * .035;
        if (model.userData.wings) model.userData.wings.forEach((wing, i) => { wing.rotation.z = Math.sin(performance.now() * .012) * (i % 2 ? -.65 : .65); });
        controls.update(); renderer.render(scene, camera);
      };
      animate();
      state.resize = () => { const nw = mount.clientWidth || 1, nh = mount.clientHeight || 1; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); };
      window.addEventListener("resize", state.resize);
    } catch (_) { $("#specimen-emoji").textContent = emoji; }
  };

  // Menutup modal spesimen dan mengosongkan sumber daya WebGL.
  App.closeSpecimen = function () {
    const s = App.state.specimen;
    if (s && s.resize) window.removeEventListener("resize", s.resize);
    App.disposeSpecimen(); $("#specimen-modal").hidden = true;
  };

  // Menyiapkan sertifikat cetak dengan nama dan hasil kuis.
  App.printCertificate = function () {
    const name = $("#student-name").value.trim() || "Penjelajah";
    const score = $("#certificate").dataset.score || "0";
    const rank = $("#certificate").dataset.rank || "Penjelajah Pemula";
    $("#certificate-print").innerHTML = `<div style="text-align:center;border:8px double #168c9b;padding:55px;margin:20px"><h1>🌍 Sertifikat Penjelajah</h1><p>Diberikan kepada</p><h2>${esc(name)}</h2><p>atas keberhasilan menjelajahi keragaman hayati dunia</p><h2>Skor ${esc(score)}% · ${esc(rank)}</h2><p>${new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</p><p>Petualangan Globe Bumi 3D · Geografi Kelas XI</p></div>`;
    window.print();
  };

  // Merender kesimpulan, refleksi akademik, dan panel tentang aplikasi.
  App.renderConclusion = function () {
    $("#conclusion-cards").innerHTML = D.kesimpulan.map((x, i) => `<article class="info-card"><span class="card-kicker">RANGKUMAN ${i + 1}</span><h3>${esc(x)}</h3><p><strong>Intinya:</strong> pengetahuan menjadi bermakna saat diterapkan.</p></article>`).join("");
    $("#about-content").innerHTML = `<p><b>Sumber utama:</b> ${esc(D.meta.sitasi)}</p><p><b>Lencana Buku:</b> informasi dari materi utama. <b>Pengayaan:</b> tambahan di luar buku.</p><p>Koordinat dan posisi Garis Wallace–Weber merupakan pendekatan visual edukatif. Aplikasi mengikuti pembagian delapan wilayah fauna yang dipakai dalam buku.</p>`;
    App.updateConclusionPassport();
  };
  App.updateConclusionPassport = function () {
    const p = App.state.passport;
    $("#conclusion-passport").innerHTML = `<span class="eyebrow">🛂 PASPOR PENJELAJAH</span><h2>${$("#rank-label").textContent} · ${$("#xp-label").textContent}</h2><p>${esc($("#passport-summary").textContent)}</p><p>Skor kuis terbaik: <b>${App.state.best ? App.state.best + "%" : "belum ada"}</b></p><p>${store.get("badge-earned", "") ? "🏅 Lencana Penjelajah Lengkap didapat!" : "Terus jelajahi untuk melengkapi paspormu."}</p><strong>Intinya:</strong> perjalananmu bisa menginspirasi tindakan nyata.`;
  };

  // Menyiapkan semua event listener setelah dokumen siap.
  App.init = function () {
    $("#footer-citation").textContent = D.meta.sitasi + " · Lencana Pengayaan berarti tambahan di luar buku.";
    App.renderObjectives(); App.renderMaterials(); App.renderConclusion(); App.updateBest(); App.updatePassport();
    App.setupCompare(); App.initGlobe(); App.startGuide();
    document.addEventListener("click", e => {
      const tab = e.target.closest(".tab-btn");
      if (tab) { App.showTab(tab.dataset.tab); return; }
      const material = e.target.closest("[data-material]");
      if (material) { App.state.material = material.dataset.material; App.renderMaterials(); return; }
      const action = e.target.closest("[data-action]");
      if (!action) return;
      const a = action.dataset.action;
      if (a === "start") { App.showTab("globe"); App.terbang(-2, 118, 1.7, 2500); }
      if (a === "fly") App.terbang(action.dataset.lat, action.dataset.lng, 1.1, 1800);
      if (a === "close-drawer") $("#info-drawer").classList.remove("open");
      if (a === "hide-controls") { $(".globe-controls").hidden = true; $("#show-controls").style.display = "block"; }
      if (a === "show-controls") { $(".globe-controls").hidden = false; $("#show-controls").style.display = "none"; }
      if (a === "hide-guide") $(".guide-bubble").hidden = true;
      if (a === "daynight" && App.state.globe) { App.state.night = !App.state.night; App.state.globe.globeImageUrl(App.state.night ? "https://unpkg.com/three-globe/example/img/earth-night.jpg" : "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"); }
      if (a === "reset-camera" && App.state.globe) App.state.globe.pointOfView({ lat: -2, lng: 118, altitude: 1.7 }, 1600);
      if (a === "autorotate" && App.state.globe) { App.state.autoRotate = !App.state.autoRotate; App.state.globe.controls().autoRotate = App.state.autoRotate; }
      if (a === "compare") App.compare();
      if (a === "stamp") { const p = App.state.passport; if (!p.biomes.includes(action.dataset.id)) p.biomes.push(action.dataset.id); store.set("passport", JSON.stringify(p)); App.updatePassport(); }
      if (a === "species") {
        const name = action.dataset.name;
        const all = [...D.bioma.flatMap(b => [...b.flora, ...b.fauna, ...b.serangga]), ...D.wilayahFauna.flatMap(w => [...w.fauna, ...w.serangga]), ...D.floraIndonesia.wilayah.flatMap(w => w.flora), ...D.faunaIndonesia.flatMap(w => w.unggulan)];
        App.openSpecies(all.find(s => s.nama === name), D.bioma.find(b => b.id === action.dataset.parent) || D.wilayahFauna.find(w => w.id === action.dataset.parent));
      }
      if (a === "open-specimen") App.openSpecimen(action.dataset.model, action.dataset.name, action.dataset.emoji, action.dataset.fact);
      if (a === "close-specimen") App.closeSpecimen();
      if (a === "specimen-next" || a === "specimen-prev") {
        const keys = D.model3D, current = App.state.specimen && App.state.specimen.modelKey;
        const i = Math.max(0, keys.indexOf(current)), next = keys[(i + (a === "specimen-next" ? 1 : keys.length - 1)) % keys.length];
        const name = next.replace(/[A-Z]/g, m => " " + m).replace(/^./, m => m.toUpperCase());
        App.openSpecimen(next, name, "✨", "Model ilustrasi prosedural untuk membantu mengenali bentuk umum spesimen.");
      }
      if (a === "quiz-quick") App.startQuiz("quick");
      if (a === "quiz-full") App.startQuiz("full");
      if (a === "quiz-next") { App.state.quiz.index++; App.renderQuizQuestion(); }
      if (a === "quiz-wrong") App.retryWrong();
      if (a === "weak-globe") { App.showTab("globe"); App.terbang(-2, 118, 1.4, 1600); }
      if (a === "print-certificate") App.printCertificate();
      if (a === "reload") location.reload();
      if (action.classList.contains("option-btn")) App.answerQuiz(Number(action.dataset.answer));
    });
    $$(".tab-btn").forEach((b, i, arr) => b.addEventListener("keydown", e => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const next = arr[(i + (e.key === "ArrowRight" ? 1 : arr.length - 1)) % arr.length]; next.focus(); next.click(); }
    }));
    $$("[data-layer]").forEach(input => input.addEventListener("change", () => { App.state.layers[input.dataset.layer] = input.checked; App.refreshGlobe(); }));
    $("#place-search").addEventListener("input", App.search);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { $("#info-drawer").classList.remove("open"); if (!$("#specimen-modal").hidden) App.closeSpecimen(); }
      if (App.state.tab === "kuis" && ["1","2","3","4"].includes(e.key)) {
        const option = $$(".option-btn")[Number(e.key) - 1]; if (option && !option.disabled) App.answerQuiz(Number(e.key) - 1);
      }
    });
    document.addEventListener("lkpd:goto", e => {
      const d = e.detail || {}; App.terbang(d.lat, d.lng, 1.2, 1800);
    });
    $("#specimen-modal").addEventListener("click", e => { if (e.target.id === "specimen-modal") App.closeSpecimen(); });
  };

  // Menyediakan hasil autocomplete dari bioma, fauna, flora, dan spesies.
  App.search = function () {
    const q = $("#place-search").value.trim().toLocaleLowerCase("id");
    const out = $("#search-results");
    if (!q) { out.innerHTML = ""; return; }
    const items = [];
    D.bioma.forEach(x => { if (x.nama.toLocaleLowerCase("id").includes(q)) items.push({ label: x.nama, lat: x.lokasi[0].lat, lng: x.lokasi[0].lng, type: "biome", data: x, emoji: x.emoji }); });
    D.wilayahFauna.forEach(x => { if (x.nama.toLocaleLowerCase("id").includes(q)) items.push({ label: x.nama, lat: x.pusat.lat, lng: x.pusat.lng, type: "fauna", data: x, emoji: x.emoji }); });
    [...D.bioma.flatMap(b => [...b.flora, ...b.fauna, ...b.serangga].map(s => ({ s, b }))), ...D.wilayahFauna.flatMap(w => [...w.fauna, ...w.serangga].map(s => ({ s, b: w })))].forEach(({ s, b }) => { if (s.nama.toLocaleLowerCase("id").includes(q)) items.push({ label: s.nama, lat: App.locationFor(b).lat, lng: App.locationFor(b).lng, type: "species", data: { species: s, biome: b }, emoji: s.emoji }); });
    out.innerHTML = items.slice(0, 7).map((x, i) => `<button data-search-index="${i}">${esc(x.emoji)} ${esc(x.label)}</button>`).join("");
    $$("[data-search-index]", out).forEach(b => b.addEventListener("click", () => {
      const x = items[Number(b.dataset.searchIndex)]; App.terbang(x.lat, x.lng, .65, 1600); App.openCard(x); out.innerHTML = "";
    }));
  };

  // Menghubungkan model tombol sebelumnya/berikutnya dengan daftar spesimen.
  const originalOpen = App.openSpecimen;
  App.openSpecimen = function (key, name, emoji, fact) {
    originalOpen(key, name, emoji, fact);
    if (App.state.specimen) App.state.specimen.modelKey = key;
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", App.init, { once: true });
  else App.init();
})();