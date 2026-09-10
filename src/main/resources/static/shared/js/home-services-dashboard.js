(() => {
    "use strict";

    const body = document.body;
    const platform = body?.dataset.platform || "";
    const role = body?.dataset.dashboardRole || "";
    const isResident = ["smartapartment", "smartsociety"].includes(platform) && role === "resident";
    const isCustomer = platform === "propertydirect" && role === "customer";
    if (!isResident && !isCustomer) return;

    const preferredSectionId = isResident ? "nobrokerServicesSection" : "customerNoBrokerServicesSection";
    const sourcePlatform = isCustomer ? "propertydirect" : "smartsociety";
    const bookingPrefix = isCustomer ? "PD-HS" : "SS-HS";

    const serviceOptions = [
        ["Home Cleaning", 499, "Home Cleaning", "Bathroom, kitchen, sofa and full-home cleaning"],
        ["Bathroom Cleaning", 399, "Home Cleaning", "Tiles, floor, WC, basin, exhaust and fittings cleaning"],
        ["Kitchen Cleaning", 499, "Home Cleaning", "Oil, chimney exterior, cabinets, platform and sink cleaning"],
        ["Premium Cleaning", 799, "Home Cleaning", "Move-in or deep-clean checklist with quality recheck"],
        ["Sofa Cleaning", 349, "Home Cleaning", "Fabric sofa shampooing and stain inspection"],
        ["Packers & Movers", 999, "Packers & Movers", "Local and intercity shifting quote request"],
        ["Painting & Waterproofing", 399, "Painting", "Wall touch-up, repainting and damp inspection"],
        ["Rental & Legal Agreement", 299, "Legal Agreement", "Rental or sale agreement draft and doorstep workflow"],
        ["Electrician, Plumber & Carpenter", 49, "Home Repairs", "General repair inspection and job estimate"],
        ["Tap Repair", 199, "Plumbing", "Tap leakage, washer, nozzle and fitting inspection"],
        ["Switch Board Repair", 149, "Electrical", "Switch, socket, light or fan repair inspection"],
        ["Cupboard Hinge", 179, "Carpentry", "Hinge, handle, drawer channel and cupboard alignment"],
        ["Geyser Repair", 299, "Appliance Repair", "Geyser inspection, heating issue and connection check"],
        ["Fan Repair", 199, "Electrical", "Fan regulator, noise, wobble or wiring inspection"],
        ["AC & Appliance Repair", 399, "Appliance Repair", "AC service, refrigerator and washing machine repair request"],
        ["Interior & Renovation", 0, "Interior and Renovation", "Design consultation and custom estimate"],
        ["Pest Control & Sanitization", 299, "Pest Control", "Cockroach, termite, bed bug and herbal treatment request"],
        ["Drill & Hang", 99, "Carpentry", "Wall drilling, mirror, shelf, frame and curtain fitting"],
        ["Door & Lock Fitting", 149, "Carpentry", "Door lock repair, replacement and alignment"],
        ["Furniture Assembly", 299, "Carpentry", "Bed, wardrobe, table, chair and modular furniture assembly"]
    ];

    const faqs = [
        ["How do I book a service?", "Select a service, fill contact/address details, choose a date and submit. The ticket is saved in the backend."],
        ["Who fulfills the service?", "The physical work is handled by verified external home-service technicians."],
        ["Are material charges included?", "No. Labour/inspection pricing is indicative. Spare parts, hardware and extra work require vendor confirmation."],
        ["Can I track the booking after refresh?", "Yes. Submitted bookings reload from the backend in the My Bookings table."],
        ["Can a ticket be closed?", "Yes. Click Mark Resolved once the work is completed and verified."]
    ];

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));

    function notify(message) {
        if (typeof window.showToast === "function") return window.showToast(message);
        alert(message);
    }

    function serviceMeta(service) {
        const item = serviceOptions.find(([name]) => name === service) || serviceOptions.find(([name]) => String(service).includes(name));
        const name = item?.[0] || service || "Home Service";
        const price = Number(item?.[1] ?? 49);
        const category = item?.[2] || "Home Services";
        return {
            category,
            option: item?.[3] || "Standard service visit",
            warranty: category === "Carpentry" || category === "Home Repairs" ? "30 days workmanship support" : "Vendor confirmation required",
            priceLabel: price === 0 ? "Quote after inspection" : `Starts at Rs. ${price}`,
            price
        };
    }

    function commonCategory(category) {
        if (/clean/i.test(category)) return "Cleaning";
        if (/paint/i.test(category)) return "Painting";
        if (/plumb/i.test(category)) return "Plumbing";
        if (/electric/i.test(category)) return "Electrical";
        if (/inspection|interior|agreement|packers|pest|handover/i.test(category)) return "Inspection";
        return "Carpentry";
    }

    function upsertServiceOptions() {
        const select = document.getElementById("nbSelectedService");
        if (!select) return;
        serviceOptions.forEach(([name, price]) => {
            const value = `${name}|${price}`;
            let option = Array.from(select.options).find(item => item.value.split("|")[0] === name);
            if (!option) {
                option = new Option(`${name} (${price === 0 ? "Quote after inspection" : `Starts Rs. ${price}`})`, value);
                select.add(option);
            } else {
                option.value = value;
            }
        });
    }

    function addStyles() {
        if (document.getElementById("homeServicesDashboardStyles")) return;
        const style = document.createElement("style");
        style.id = "homeServicesDashboardStyles";
        style.textContent = `
            [data-home-services-root] {
                display: flex !important;
                flex-direction: column !important;
                gap: 24px !important;
                margin: 0 0 40px 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
                color: #0f172a !important;
            }
            [data-home-services-root] * {
                box-sizing: border-box !important;
            }

            .hs-mainbar {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 20px !important;
                padding: 16px 24px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 20px !important;
                box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04) !important;
                width: 100% !important;
            }
            .hs-mainbar-title {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                white-space: nowrap !important;
            }
            .hs-city-tag {
                font-size: 0.76rem !important;
                font-weight: 800 !important;
                background: #fef2f2 !important;
                color: #dc2626 !important;
                padding: 4px 12px !important;
                border-radius: 999px !important;
                border: 1px solid #fecaca !important;
            }
            .hs-mainbar-search {
                flex: 1 !important;
                max-width: 540px !important;
                position: relative !important;
            }
            .hs-mainbar-search input {
                width: 100% !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 999px !important;
                padding: 11px 20px 11px 42px !important;
                font-size: 0.88rem !important;
                font-weight: 600 !important;
                color: #0f172a !important;
                background: #f8fafc !important;
                outline: none !important;
                transition: all 0.2s ease !important;
                box-shadow: none !important;
            }
            .hs-mainbar-search input:focus {
                background: #ffffff !important;
                border-color: #2563eb !important;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
            }
            .hs-mainbar-search-icon {
                position: absolute !important;
                left: 16px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                color: #94a3b8 !important;
                font-size: 0.9rem !important;
                pointer-events: none !important;
            }
            .hs-mainbar-btn {
                all: unset !important;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
                color: #ffffff !important;
                border-radius: 999px !important;
                padding: 10px 22px !important;
                font-size: 0.85rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25) !important;
                transition: all 0.2s ease !important;
                white-space: nowrap !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .hs-mainbar-btn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35) !important;
            }

            .hs-strip {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 20px !important;
                padding: 24px !important;
                box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04) !important;
                width: 100% !important;
            }
            .hs-strip-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 20px !important;
            }
            .hs-strip-title {
                margin: 0 !important;
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                letter-spacing: -0.01em !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
            }

            .hs-category-grid {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 16px !important;
                width: 100% !important;
            }
            .hs-category-card {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 16px !important;
                padding: 20px !important;
                text-align: left !important;
                cursor: pointer !important;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 145px !important;
                height: 100% !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            .hs-category-card:hover {
                border-color: #2563eb !important;
                transform: translateY(-3px) !important;
                box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12) !important;
                background: #ffffff !important;
            }
            .hs-category-card-top {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
                margin-bottom: 12px !important;
            }
            .hs-category-icon-badge {
                width: 44px !important;
                height: 44px !important;
                border-radius: 12px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 1.15rem !important;
                flex-shrink: 0 !important;
            }
            .hs-price-pill {
                font-size: 0.74rem !important;
                font-weight: 800 !important;
                background: #f8fafc !important;
                color: #475569 !important;
                border: 1px solid #e2e8f0 !important;
                padding: 3px 10px !important;
                border-radius: 999px !important;
                white-space: nowrap !important;
            }
            .hs-category-card h6 {
                margin: 0 0 4px 0 !important;
                font-size: 0.96rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                line-height: 1.35 !important;
            }
            .hs-category-card p {
                margin: 0 !important;
                font-size: 0.8rem !important;
                color: #64748b !important;
                font-weight: 500 !important;
                line-height: 1.4 !important;
            }

            .hs-quick-row {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 18px !important;
                width: 100% !important;
            }
            .hs-offer-card {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 18px !important;
                padding: 22px !important;
                box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 160px !important;
                position: relative !important;
                overflow: hidden !important;
                width: 100% !important;
            }
            .hs-offer-card::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 4px !important;
                background: linear-gradient(90deg, #2563eb, #3b82f6) !important;
            }
            .hs-offer-card:nth-child(2)::before {
                background: linear-gradient(90deg, #d97706, #f59e0b) !important;
            }
            .hs-offer-card:nth-child(3)::before {
                background: linear-gradient(90deg, #10b981, #059669) !important;
            }
            .hs-offer-card strong {
                font-size: 1.05rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                display: block !important;
                margin-bottom: 6px !important;
            }
            .hs-offer-card span {
                font-size: 0.83rem !important;
                color: #64748b !important;
                line-height: 1.5 !important;
                display: block !important;
                margin-bottom: 16px !important;
            }
            .hs-offer-card button {
                all: unset !important;
                align-self: flex-start !important;
                background: #0f172a !important;
                color: #ffffff !important;
                border-radius: 10px !important;
                padding: 8px 18px !important;
                font-size: 0.82rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                display: inline-block !important;
            }
            .hs-offer-card button:hover {
                background: #2563eb !important;
                transform: translateY(-1px) !important;
            }

            .hs-service-pills {
                display: grid !important;
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                gap: 12px !important;
                width: 100% !important;
            }
            .hs-pill-btn {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 14px !important;
                padding: 14px 16px !important;
                text-align: left !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 6px rgba(15, 23, 42, 0.02) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 76px !important;
                margin: 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            .hs-pill-btn:hover {
                border-color: #2563eb !important;
                background: #f0f7ff !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 16px rgba(37, 99, 235, 0.1) !important;
            }
            .hs-pill-title {
                font-size: 0.88rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                margin-bottom: 6px !important;
                line-height: 1.3 !important;
            }
            .hs-pill-price {
                font-size: 0.76rem !important;
                font-weight: 800 !important;
                color: #2563eb !important;
                background: #eff6ff !important;
                padding: 2px 8px !important;
                border-radius: 6px !important;
                display: inline-block !important;
                align-self: flex-start !important;
            }

            .hs-table {
                width: 100% !important;
                border-collapse: separate !important;
                border-spacing: 0 !important;
            }
            .hs-table th {
                background: #f8fafc !important;
                color: #475569 !important;
                font-size: 0.78rem !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.04em !important;
                padding: 12px 16px !important;
                border-bottom: 2px solid #e2e8f0 !important;
            }
            .hs-table td {
                padding: 14px 16px !important;
                border-bottom: 1px solid #f1f5f9 !important;
                font-size: 0.88rem !important;
                color: #334155 !important;
            }
            .hs-table tr:last-child td {
                border-bottom: none !important;
            }

            .hs-form-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 16px !important;
                width: 100% !important;
            }
            .hs-form-group {
                display: flex !important;
                flex-direction: column !important;
                gap: 6px !important;
            }
            .hs-form-group.full-width {
                grid-column: span 2 !important;
            }
            .hs-form-label {
                font-size: 0.82rem !important;
                font-weight: 800 !important;
                color: #334155 !important;
            }
            .hs-form-control {
                width: 100% !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 12px !important;
                padding: 11px 14px !important;
                font-size: 0.88rem !important;
                font-weight: 600 !important;
                color: #0f172a !important;
                background: #ffffff !important;
                outline: none !important;
                transition: border-color 0.2s ease !important;
            }
            .hs-form-control:focus {
                border-color: #2563eb !important;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
            }
            .hs-submit-btn {
                all: unset !important;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
                color: #ffffff !important;
                border-radius: 12px !important;
                padding: 13px 28px !important;
                font-size: 0.9rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25) !important;
                transition: all 0.2s ease !important;
                text-align: center !important;
                display: inline-block !important;
            }
            .hs-submit-btn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35) !important;
            }

            .hs-faq-list details {
                border-bottom: 1px solid #f1f5f9 !important;
                padding: 14px 0 !important;
            }
            .hs-faq-list details:last-child {
                border-bottom: none !important;
            }
            .hs-faq-list summary {
                font-size: 0.95rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                cursor: pointer !important;
                user-select: none !important;
            }
            .hs-faq-list p {
                margin: 10px 0 0 0 !important;
                font-size: 0.86rem !important;
                color: #64748b !important;
                line-height: 1.55 !important;
            }

            @media (max-width: 1200px) {
                .hs-category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                .hs-service-pills { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            }
            @media (max-width: 820px) {
                .hs-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                .hs-quick-row { grid-template-columns: 1fr !important; }
                .hs-service-pills { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                .hs-form-grid { grid-template-columns: 1fr !important; }
                .hs-form-group.full-width { grid-column: span 1 !important; }
                .hs-mainbar { flex-direction: column !important; align-items: stretch !important; }
                .hs-mainbar-search { max-width: 100% !important; }
            }
            @media (max-width: 520px) {
                .hs-category-grid { grid-template-columns: 1fr !important; }
                .hs-service-pills { grid-template-columns: 1fr !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function serviceIconSvg(label) {
        const name = String(label || "").toLowerCase();
        if (/clean|bathroom|kitchen|sofa/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18"/><path d="M7 21V9l5-5 5 5v12"/><path d="M9 14h6"/><path d="M10 17h4"/></svg>';
        if (/pack|mover|shift/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="6" width="12" height="9" rx="2"/><path d="M14 9h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
        if (/paint|water/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h11v5H4z"/><path d="M15 9h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-5"/><path d="M8 12v8"/><path d="M6 20h4"/></svg>';
        if (/agreement|legal|tenant/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/></svg>';
        if (/electric|plumber|carpenter|repair|tap|switch|fan|drill|door|lock|cupboard|furniture/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14.5 5.5l4 4"/><path d="M4 20l6.5-6.5"/><path d="M13 4l7 7-5 5-7-7z"/><path d="M5 19l-1 1"/></svg>';
        if (/interior|renovation/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 13h16v7H4z"/><path d="M7 13V8a3 3 0 0 1 6 0v5"/><path d="M17 13V9"/><path d="M6 20v2M18 20v2"/></svg>';
        if (/ac|appliance|geyser/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="8" rx="2"/><path d="M7 16h10"/><path d="M8 20h8"/><path d="M7 8h.01M11 8h6"/></svg>';
        if (/pest|sanit/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 3v4M6 11h12M6 15h12M4 9l3 2M20 9l-3 2M4 18l3-2M20 18l-3-2"/></svg>';
        return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>';
    }

    function repairLegacyNoBrokerIcons() {
        document.querySelectorAll(".nobroker-cat-item .rounded-circle").forEach(iconBox => {
            const card = iconBox.closest(".nobroker-cat-item");
            const label = card?.querySelector("h6")?.textContent || card?.textContent || "";
            iconBox.innerHTML = serviceIconSvg(label);
            iconBox.style.background = "#ffffff";
            iconBox.style.border = "1px solid #e2e8f0";
            iconBox.style.color = getComputedStyle(iconBox).color || "#2563eb";
        });
        document.querySelectorAll("#carpentryCatalogue .rounded-circle, #carpentryCatalogue .nb-service-thumb, #carpentryCatalogue [class*='thumb']").forEach(iconBox => {
            const label = iconBox.closest("[data-service-name], .card, .service-card, .nb-service-card")?.textContent || "";
            if (!iconBox.querySelector("svg")) iconBox.innerHTML = serviceIconSvg(label);
            iconBox.style.display = "inline-flex";
            iconBox.style.alignItems = "center";
            iconBox.style.justifyContent = "center";
            iconBox.style.background = "#ffffff";
            iconBox.style.border = "1px solid #e2e8f0";
            iconBox.style.color = "#2563eb";
        });
    }

    function findSection() {
        return document.getElementById(preferredSectionId) || document.querySelector('[data-view="services"]');
    }

    function homeServicesMarkup() {
        const categories = [
            ["Home Cleaning", "Bathroom, kitchen, sofa and full-home cleaning", 499, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M7 7l10 10M7 17L17 7"/></svg>`, "bg-fef2f2 text-dc2626"],
            ["Packers & Movers", "Local and intercity movement quote request", 999, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`, "bg-eff6ff text-2563eb"],
            ["Painting & Waterproofing", "Wall touch-up, repainting and damp inspection", 399, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h11v5H4z"/><path d="M15 9h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-5"/><path d="M8 12v8"/><path d="M6 20h4"/></svg>`, "bg-fffbeb text-d97706"],
            ["Rental & Legal Agreement", "Rental or sale agreement draft and doorstep workflow", 299, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, "bg-ecfeff text-0891b2"],
            ["Electrician, Plumber & Carpenter", "General repair inspection and job estimate", 49, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`, "bg-ecfdf5 text-059669"],
            ["Interior & Renovation", "Design consultation and modular work quote", 0, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M4 18v2M20 18v2"/></svg>`, "bg-faf5ff text-7c3aed"],
            ["AC & Appliance Repair", "AC service, refrigerator and washing machine repair", 399, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07l14.14-14.14"/></svg>`, "bg-f0fdf4 text-0d9488"],
            ["Pest Control & Sanitization", "Cockroach, termite, bed bug and herbal treatment", 299, `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M6 10h12M6 14h12M6 18h12M12 2v4"/></svg>`, "bg-fff1f2 text-e11d48"]
        ];

        return `
            <div data-home-services-root id="homeServicesDashboardModern">
                <header class="hs-mainbar">
                    <div class="hs-mainbar-title">
                        <span>Home Services</span>
                        <span class="hs-city-tag">Bangalore ▾</span>
                    </div>
                    <div class="hs-mainbar-search">
                        <span class="hs-mainbar-search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>
                        <input type="search" id="hsDashboardSearch" placeholder="Search Kitchen Cleaning, Painting, Packers, Carpenter, AC Repair..." autocomplete="off">
                    </div>
                    <button type="button" class="hs-mainbar-btn" data-hs-bookings>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        My Bookings
                    </button>
                </header>

                <section class="hs-strip">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Explore All Home Services</h5>
                    </div>
                    <div class="hs-category-grid">
                        ${categories.map(([name, desc, price, iconSvg, styleTheme]) => {
                            const [bgClass, textClass] = styleTheme.split(" ");
                            const bgStyle = bgClass === "bg-fef2f2" ? "background:#fef2f2;" : bgClass === "bg-eff6ff" ? "background:#eff6ff;" : bgClass === "bg-fffbeb" ? "background:#fffbeb;" : bgClass === "bg-ecfeff" ? "background:#ecfeff;" : bgClass === "bg-ecfdf5" ? "background:#ecfdf5;" : bgClass === "bg-faf5ff" ? "background:#faf5ff;" : bgClass === "bg-f0fdf4" ? "background:#f0fdf4;" : "background:#fff1f2;";
                            const textStyle = textClass === "text-dc2626" ? "color:#dc2626;" : textClass === "text-2563eb" ? "color:#2563eb;" : textClass === "text-d97706" ? "color:#d97706;" : textClass === "text-0891b2" ? "color:#0891b2;" : textClass === "text-059669" ? "color:#059669;" : textClass === "text-7c3aed" ? "color:#7c3aed;" : textClass === "text-0d9488" ? "color:#0d9488;" : "color:#e11d48;";

                            return `
                                <div role="button" tabindex="0" class="hs-category-card" data-hs-book="${escapeHtml(name)}|${price}">
                                    <div class="hs-category-card-top">
                                        <div class="hs-category-icon-badge" style="${bgStyle}${textStyle}">${iconSvg}</div>
                                        <span class="hs-price-pill">${price === 0 ? "Custom Quote" : `Starts Rs. ${price}`}</span>
                                    </div>
                                    <div>
                                        <h6>${escapeHtml(name)}</h6>
                                        <p>${escapeHtml(desc)}</p>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </section>

                <div class="hs-quick-row">
                    <article class="hs-offer-card">
                        <strong>VIP Membership</strong>
                        <span>Inspection fee waiver and discount support for selected home services.</span>
                        <button type="button" data-hs-offer="vip">Buy Pass</button>
                    </article>
                    <article class="hs-offer-card">
                        <strong>Free Tenant Verification</strong>
                        <span>Useful for rental onboarding, agreement checks and customer move-in workflows.</span>
                        <button type="button" data-hs-book="Rental & Legal Agreement|299">Create Agreement</button>
                    </article>
                    <article class="hs-offer-card">
                        <strong>Home Repairs</strong>
                        <span>Electrician, plumber and carpenter visits starting from the inspection flow.</span>
                        <button type="button" data-hs-book="Electrician, Plumber & Carpenter|49">Book Repairs</button>
                    </article>
                </div>

                <section class="hs-strip">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Home Cleaning Services</h5>
                    </div>
                    <div class="hs-service-pills">
                        ${["Bathroom Cleaning","Kitchen Cleaning","Premium Cleaning","Sofa Cleaning","Home Cleaning"].map(name => {
                            const item = serviceOptions.find(([service]) => service === name);
                            return `
                                <div role="button" tabindex="0" class="hs-pill-btn" data-hs-book="${escapeHtml(item[0])}|${item[1]}">
                                    <span class="hs-pill-title">${escapeHtml(item[0])}</span>
                                    <span class="hs-pill-price">${item[1] ? `Starts Rs. ${item[1]}` : "Quote"}</span>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </section>

                <section class="hs-strip">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Home Repair Services</h5>
                    </div>
                    <div class="hs-service-pills">
                        ${["Tap Repair","Switch Board Repair","Cupboard Hinge","Geyser Repair","Fan Repair"].map(name => {
                            const item = serviceOptions.find(([service]) => service === name);
                            return `
                                <div role="button" tabindex="0" class="hs-pill-btn" data-hs-book="${escapeHtml(item[0])}|${item[1]}">
                                    <span class="hs-pill-title">${escapeHtml(item[0])}</span>
                                    <span class="hs-pill-price">Starts Rs. ${item[1]}</span>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </section>

                <section class="hs-strip">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Rate Card & Price Comparison</h5>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="hs-table">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Scope & Details</th>
                                    <th>Standard Rate</th>
                                    <th>VIP Pass Rate</th>
                                    <th>Warranty</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Drill & Hang Wall Mounts</strong></td>
                                    <td>TV bracket, wall shelf, curtain rod, frames & clock installation</td>
                                    <td><span style="text-decoration: line-through; color: #94a3b8;">Rs. 149</span></td>
                                    <td><strong style="color: #059669;">Rs. 99</strong></td>
                                    <td>30 Days Warranty</td>
                                    <td><button type="button" class="hs-offer-card-btn" style="all:unset; background:#2563eb; color:#fff; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;" data-hs-book="Drill & Hang|99">Book Rs. 99</button></td>
                                </tr>
                                <tr>
                                    <td><strong>Door & Lock Fitting</strong></td>
                                    <td>Door lock repair, handle / latch setup, door shaving & hinges repair</td>
                                    <td><span style="text-decoration: line-through; color: #94a3b8;">Rs. 199</span></td>
                                    <td><strong style="color: #059669;">Rs. 149</strong></td>
                                    <td>30 Days Warranty</td>
                                    <td><button type="button" class="hs-offer-card-btn" style="all:unset; background:#2563eb; color:#fff; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;" data-hs-book="Door & Lock Fitting|149">Book Rs. 149</button></td>
                                </tr>
                                <tr>
                                    <td><strong>Cupboards & Drawer Repair</strong></td>
                                    <td>Drawer channels, wardrobe hinges, handle replacements & shelf repair</td>
                                    <td><span style="text-decoration: line-through; color: #94a3b8;">Rs. 229</span></td>
                                    <td><strong style="color: #059669;">Rs. 179</strong></td>
                                    <td>30 Days Warranty</td>
                                    <td><button type="button" class="hs-offer-card-btn" style="all:unset; background:#2563eb; color:#fff; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;" data-hs-book="Cupboard Hinge|179">Book Rs. 179</button></td>
                                </tr>
                                <tr>
                                    <td><strong>Furniture Assembly</strong></td>
                                    <td>Bed assembly, study table, 2/3 door wardrobe & modular furniture setup</td>
                                    <td><span style="text-decoration: line-through; color: #94a3b8;">Rs. 399</span></td>
                                    <td><strong style="color: #059669;">Rs. 299</strong></td>
                                    <td>60 Days Warranty</td>
                                    <td><button type="button" class="hs-offer-card-btn" style="all:unset; background:#2563eb; color:#fff; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;" data-hs-book="Furniture Assembly|299">Book Rs. 299</button></td>
                                </tr>
                                <tr>
                                    <td><strong>Full Home Deep Cleaning</strong></td>
                                    <td>Single/multi-room deep cleaning, kitchen & bathroom scrubbing</td>
                                    <td><span style="text-decoration: line-through; color: #94a3b8;">Rs. 799</span></td>
                                    <td><strong style="color: #059669;">Rs. 499</strong></td>
                                    <td>Quality Re-check Support</td>
                                    <td><button type="button" class="hs-offer-card-btn" style="all:unset; background:#2563eb; color:#fff; padding:6px 14px; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;" data-hs-book="Home Cleaning|499">Book Rs. 499</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="hs-strip" id="nobrokerBookingFormAnchor">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Book Home Service Request</h5>
                    </div>
                    <form id="noBrokerBookingForm" onsubmit="handleNoBrokerSubmit(event)">
                        <div class="hs-form-grid">
                            <div class="hs-form-group">
                                <label class="hs-form-label" for="nbSelectedService">Select Service Category & Starting Price</label>
                                <select class="hs-form-control" id="nbSelectedService" required onchange="window.updateNoBrokerCheckoutPrice?.()">
                                    <option value="Home Cleaning|499">Home Cleaning (Starts Rs. 499)</option>
                                    <option value="Bathroom Cleaning|399">Bathroom Cleaning (Starts Rs. 399)</option>
                                    <option value="Kitchen Cleaning|499">Kitchen Cleaning (Starts Rs. 499)</option>
                                    <option value="Premium Cleaning|799">Premium Cleaning (Starts Rs. 799)</option>
                                    <option value="Sofa Cleaning|349">Sofa Cleaning (Starts Rs. 349)</option>
                                    <option value="Packers & Movers|999">Packers & Movers (Starts Rs. 999)</option>
                                    <option value="Painting & Waterproofing|399">Painting & Waterproofing (Starts Rs. 399)</option>
                                    <option value="Rental & Legal Agreement|299">Rental & Legal Agreement (Starts Rs. 299)</option>
                                    <option value="Electrician, Plumber & Carpenter|49">Electrician, Plumber & Carpenter (Starts Rs. 49)</option>
                                    <option value="Tap Repair|199">Tap Repair (Starts Rs. 199)</option>
                                    <option value="Switch Board Repair|149">Switch Board Repair (Starts Rs. 149)</option>
                                    <option value="Cupboard Hinge|179">Cupboard Hinge (Starts Rs. 179)</option>
                                    <option value="Geyser Repair|299">Geyser Repair (Starts Rs. 299)</option>
                                    <option value="Fan Repair|199">Fan Repair (Starts Rs. 199)</option>
                                    <option value="AC & Appliance Repair|399">AC & Appliance Repair (Starts Rs. 399)</option>
                                    <option value="Interior & Renovation|0">Interior & Renovation (Quote after inspection)</option>
                                    <option value="Pest Control & Sanitization|299">Pest Control & Sanitization (Starts Rs. 299)</option>
                                    <option value="Drill & Hang|99">Drill & Hang (Starts Rs. 99)</option>
                                    <option value="Door & Lock Fitting|149">Door & Lock Fitting (Starts Rs. 149)</option>
                                    <option value="Furniture Assembly|299">Furniture Assembly (Starts Rs. 299)</option>
                                </select>
                            </div>
                            <div class="hs-form-group">
                                <label class="hs-form-label" for="nbServiceDate">Preferred Service Date</label>
                                <input type="date" class="hs-form-control" id="nbServiceDate" required>
                            </div>
                            <div class="hs-form-group">
                                <label class="hs-form-label" for="nbServiceSlot">Preferred Time Slot</label>
                                <select class="hs-form-control" id="nbServiceSlot" required>
                                    <option value="EXPRESS_60MIN">Express 60-Minute Arrival</option>
                                    <option value="MORNING">Morning (09:00 AM - 12:00 PM)</option>
                                    <option value="AFTERNOON">Afternoon (12:00 PM - 03:00 PM)</option>
                                    <option value="EVENING">Evening (04:00 PM - 07:00 PM)</option>
                                </select>
                            </div>
                            <div class="hs-form-group">
                                <label class="hs-form-label" for="nbCustomerName">Customer / Resident Name</label>
                                <input type="text" class="hs-form-control" id="nbCustomerName" placeholder="Enter your full name" required>
                            </div>
                            <div class="hs-form-group">
                                <label class="hs-form-label" for="nbCustomerPhone">Contact Phone Number *</label>
                                <input type="tel" class="hs-form-control" id="nbCustomerPhone" placeholder="Enter 10-digit mobile number" required maxlength="10" inputmode="numeric" pattern="[6-9][0-9]{9}" title="Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10)">
                            </div>
                            <div class="hs-form-group">
                                <label class="hs-form-label" for="nbAddress">Full Service Address / Unit No. *</label>
                                <input type="text" class="hs-form-control" id="nbAddress" placeholder="Flat No, Society / Property Name, City" required>
                            </div>
                            <div class="hs-form-group full-width">
                                <label class="hs-form-label" for="nbNotes">Special Instructions / Work Notes</label>
                                <textarea class="hs-form-control" id="nbNotes" rows="3" placeholder="Describe the specific work required or special requests..."></textarea>
                            </div>
                            <div class="hs-form-group full-width" style="margin-top: 10px;">
                                <button type="submit" class="hs-submit-btn">Submit Service Request</button>
                            </div>
                        </div>
                    </form>
                </section>

                <section class="hs-strip" id="nobrokerBookingsTableAnchor">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">My Service Bookings</h5>
                        <button type="button" class="hs-mainbar-btn" style="padding: 6px 16px; font-size: 0.8rem;" onclick="loadNoBrokerMaintenanceTickets()">Refresh</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="hs-table">
                            <thead>
                                <tr>
                                    <th>Ticket #</th>
                                    <th>Service Type</th>
                                    <th>Schedule Date</th>
                                    <th>Address</th>
                                    <th>Estimated Price</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="noBrokerMaintenanceRows">
                                <tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">Loading service bookings...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="hs-strip">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Frequently Asked Questions</h5>
                    </div>
                    <div class="hs-faq-list">
                        ${faqs.map(([q, a]) => `
                            <details>
                                <summary>${escapeHtml(q)}</summary>
                                <p>${escapeHtml(a)}</p>
                            </details>
                        `).join("")}
                    </div>
                </section>
            </div>
        `;
    }

    function enhanceSection() {
        const section = findSection();
        if (!section) return;
        addStyles();
        upsertServiceOptions();

        const markup = homeServicesMarkup();
        const existingModernHub = section.querySelector("#homeServicesDashboardModern");
        const hasLegacyNoBrokerContent = Boolean(
            section.querySelector("#carpentryCatalogue, .nobroker-cat-item, .nb-service-thumb, [data-nb-service]")
        );

        if (hasLegacyNoBrokerContent) {
            if (existingModernHub) {
                existingModernHub.outerHTML = markup;
            } else {
                section.insertAdjacentHTML("beforeend", markup);
            }
        } else {
            section.innerHTML = markup;
        }
        section.dataset.homeServicesEnhanced = "true";
        repairLegacyNoBrokerIcons();
    }

    window.noBrokerServiceMeta = serviceMeta;

    window.selectNoBrokerService = function selectNoBrokerService(serviceName, price) {
        const parts = String(serviceName || "").split("|");
        const name = parts[0] || "General Inspection";
        const finalPrice = Number(price ?? parts[1] ?? serviceMeta(name).price ?? 49);
        const select = document.getElementById("nbSelectedService");
        if (select) {
            upsertServiceOptions();
            const value = `${name}|${Number.isFinite(finalPrice) ? finalPrice : 49}`;
            let option = Array.from(select.options).find(item => item.value.split("|")[0] === name);
            if (!option) {
                option = new Option(`${name} (${finalPrice === 0 ? "Quote after inspection" : `Starts Rs. ${finalPrice}`})`, value);
                select.add(option);
            }
            option.value = value;
            select.value = value;
            window.updateNoBrokerCheckoutPrice?.();
        }
        const notes = document.getElementById("nbNotes");
        const meta = serviceMeta(name);
        if (notes && !notes.value.trim()) {
            notes.value = `${meta.option}\nMaterial/spare charges to be confirmed by the assigned vendor.`;
        }
        (document.getElementById("nobrokerBookingFormAnchor") || select)?.scrollIntoView({behavior: "smooth", block: "start"});
        notify(`Selected service: ${name}`);
    };

    window.selectNoBrokerCategory = function selectNoBrokerCategory(category, price) {
        const match = serviceOptions.find(([, , itemCategory]) => itemCategory === category) || serviceOptions.find(([name]) => name === category) || [category, price || 49];
        window.selectNoBrokerService(`${match[0]}|${price ?? match[1]}`);
    };

    window.filterNoBrokerServices = function filterNoBrokerServices(value) {
        const query = String(value || "").trim().toLowerCase();
        document.querySelectorAll(`.hs-category-card, .hs-pill-btn, .hs-offer-card`).forEach(item => {
            const keywords = `${item.textContent || ""}`.toLowerCase();
            item.style.display = !query || keywords.includes(query) ? "" : "none";
        });
    };

    window.scrollToNoBrokerBookingForm = function scrollToNoBrokerBookingForm() {
        document.getElementById("nobrokerBookingFormAnchor")?.scrollIntoView({behavior: "smooth", block: "start"});
    };

    window.scrollToNoBrokerBookings = function scrollToNoBrokerBookings() {
        document.getElementById("nobrokerBookingsTableAnchor")?.scrollIntoView({behavior: "smooth", block: "start"});
    };

    const originalVip = window.applyNoBrokerVipPass;
    window.applyNoBrokerVipPass = function applyNoBrokerVipPass() {
        originalVip?.();
        notify("VIP pass applied. Inspection fee waiver is shown in the booking summary.");
    };

    async function api(path, options = {}) {
        const response = await fetch(`/api/maintenance${path}`, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.detail || "Unable to save service booking.");
        return payload;
    }

    function preferredAt(date, slot) {
        const time = slot === "MORNING" ? "09:00" : slot === "AFTERNOON" ? "12:00" : slot === "EVENING" ? "16:00" : "10:00";
        return `${date}T${time}`;
    }

    window.handleNoBrokerSubmit = async function handleNoBrokerSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const selectedValue = document.getElementById("nbSelectedService")?.value || "General Inspection|49";
        const [service, price = "49"] = selectedValue.split("|");
        const meta = serviceMeta(service);
        const date = document.getElementById("nbServiceDate")?.value;
        const slot = document.getElementById("nbServiceSlot")?.value || "EXPRESS_60MIN";
        const name = document.getElementById("nbCustomerName")?.value || (isCustomer ? "Customer" : "Resident");
        const phone = document.getElementById("nbCustomerPhone")?.value || "";
        const address = document.getElementById("nbAddress")?.value || "";
        const notes = document.getElementById("nbNotes")?.value || "";
        const submit = form.querySelector('[type="submit"]');

        if (!/^[6-9]\d{9}$/.test(phone.trim())) {
            notify("Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
            const phoneInput = document.getElementById("nbCustomerPhone");
            if (phoneInput) {
                phoneInput.focus();
                phoneInput.select();
            }
            return;
        }

        const visitAt = preferredAt(date, slot);
        if (new Date(visitAt).getTime() <= Date.now()) {
            notify("Choose a future service date and time.");
            return;
        }
        submit.disabled = true;
        try {
            const reference = `${bookingPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
            const saved = await api("", {
                method: "POST",
                body: JSON.stringify({
                    sourcePlatform,
                    targetEntityType: isCustomer ? "PROPERTY_LISTING" : "APARTMENT_UNIT",
                    requesterName: name,
                    requesterPhone: phone,
                    serviceType: service,
                    serviceCategory: meta.category,
                    serviceOption: meta.option,
                    priceLabel: Number(price) === 0 ? "Quote after inspection" : `Rs. ${price}`,
                    warrantyLabel: meta.warranty,
                    title: `${service} - ${address || name}`,
                    description: [
                        `${isCustomer ? "PropertyDirect customer" : "SmartSociety resident"} home-service booking`,
                        `Selected slot: ${slot}`,
                        `Starting price / inspection fee: Rs. ${price}`,
                        meta.option && `Scope: ${meta.option}`,
                        notes && `Instructions: ${notes}`,
                        "Material, spare and extra labour charges require vendor confirmation before work starts."
                    ].filter(Boolean).join("\n"),
                    serviceAddress: address,
                    priority: slot === "EXPRESS_60MIN" ? "HIGH" : "MEDIUM",
                    preferredAt: visitAt,
                    vendorName: "External home-service vendor",
                    vendorPhone: "",
                    accessType: isCustomer ? "Customer will be present" : "Resident will be present",
                    contactMethod: "Phone",
                    externalReference: reference
                })
            });
            form.reset();
            setDefaultDate();
            window.updateNoBrokerCheckoutPrice?.();
            await window.loadNoBrokerMaintenanceTickets?.();
            notify(`Service booking #${saved.id} saved. Reference: ${reference}`);
        } catch (error) {
            notify(error.message);
        } finally {
            submit.disabled = false;
        }
    };

    window.loadNoBrokerMaintenanceTickets = async function loadNoBrokerMaintenanceTickets() {
        const rows = document.getElementById("noBrokerMaintenanceRows");
        if (!rows) return;
        try {
            const tickets = await api(`?sourcePlatform=${encodeURIComponent(sourcePlatform)}`);
            const serviceTickets = tickets.filter(ticket => {
                const content = `${ticket.serviceCategory || ""} ${ticket.serviceType || ""} ${ticket.externalReference || ""}`.toLowerCase();
                return /home|clean|pack|paint|agreement|repair|carpentry|plumb|electric|appliance|interior|pest|ss-hs|pd-hs|nb-crp/.test(content);
            });
            rows.innerHTML = serviceTickets.length ? serviceTickets.map(ticket => {
                const status = String(ticket.ticketStatus || "REQUESTED").replaceAll("_", " ");
                const done = /RESOLVED|CLOSED/i.test(status);
                const badgeStyle = done ? "background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;" : "background:#fef3c7; color:#b45309; border:1px solid #fde68a;";
                return `<tr>
                    <td><strong>#${ticket.id}</strong><br><small style="color:#64748b;">${escapeHtml(ticket.externalReference || "Service booking")}</small></td>
                    <td><strong>${escapeHtml(ticket.serviceType || "Home service")}</strong><br><small style="color:#64748b;">${escapeHtml(ticket.serviceOption || "Standard visit")}</small></td>
                    <td>${ticket.preferredAt ? new Date(ticket.preferredAt).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"}) : "-"}</td>
                    <td>${escapeHtml(ticket.serviceAddress || "-")}</td>
                    <td>${escapeHtml(ticket.priceLabel || "Rs. 49")}</td>
                    <td><span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:800; ${badgeStyle}">${escapeHtml(status)}</span></td>
                    <td>${done ? '<span style="color:#15803d; font-weight:800; font-size:0.82rem;">Closed</span>' : `<button type="button" style="all:unset; background:#ffffff; border:1px solid #16a34a; color:#16a34a; padding:4px 14px; border-radius:999px; font-size:0.78rem; font-weight:800; cursor:pointer;" onclick="resolveNoBrokerTicket(${ticket.id})">Mark Resolved</button>`}</td>
                </tr>`;
            }).join("") : '<tr><td colspan="7" style="color:#94a3b8; text-align:center; padding:24px;">No saved home-service bookings yet.</td></tr>';
        } catch (error) {
            rows.innerHTML = `<tr><td colspan="7" style="color:#dc2626; text-align:center; padding:24px;">${escapeHtml(error.message)}</td></tr>`;
        }
    };

    window.resolveNoBrokerTicket = async function resolveNoBrokerTicket(id) {
        try {
            await api(`/${id}/status`, {method: "PATCH", body: JSON.stringify({ticketStatus: "RESOLVED", vendorNotes: "Marked resolved from dashboard."})});
            notify("Service ticket marked resolved and saved.");
            await window.loadNoBrokerMaintenanceTickets?.();
        } catch (error) {
            notify(error.message);
        }
    };

    function setDefaultDate() {
        const dateInput = document.getElementById("nbServiceDate");
        if (!dateInput) return;
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        dateInput.min = tomorrow;
        if (!dateInput.value || dateInput.value < tomorrow) dateInput.value = tomorrow;
    }

    document.addEventListener("click", event => {
        const action = event.target.closest("[data-hs-book]");
        const offer = event.target.closest("[data-hs-offer]");
        const bookings = event.target.closest("[data-hs-bookings]");
        if (action) {
            event.preventDefault();
            window.selectNoBrokerService(action.dataset.hsBook);
        }
        if (offer) {
            event.preventDefault();
            window.applyNoBrokerVipPass?.();
        }
        if (bookings) {
            event.preventDefault();
            window.scrollToNoBrokerBookings?.();
        }
    }, true);

    document.addEventListener("input", event => {
        if (event.target?.id === "hsDashboardSearch") window.filterNoBrokerServices(event.target.value);
        if (event.target?.id === "nbCustomerPhone" || event.target?.name === "requesterPhone") {
            event.target.value = event.target.value.replace(/[^0-9]/g, "").slice(0, 10);
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        enhanceSection();
        repairLegacyNoBrokerIcons();
        setDefaultDate();
        window.updateNoBrokerCheckoutPrice?.();
        window.loadNoBrokerMaintenanceTickets?.();
        setTimeout(() => {
            enhanceSection();
            repairLegacyNoBrokerIcons();
        }, 250);
    });

    if (document.readyState !== "loading") {
        enhanceSection();
        repairLegacyNoBrokerIcons();
        setDefaultDate();
        window.updateNoBrokerCheckoutPrice?.();
        window.loadNoBrokerMaintenanceTickets?.();
        setTimeout(() => {
            enhanceSection();
            repairLegacyNoBrokerIcons();
        }, 250);
    }
})();
