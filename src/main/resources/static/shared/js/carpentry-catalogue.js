(() => {
    "use strict";
    if (document.getElementById("nobrokerServicesSection") || document.getElementById("customerNoBrokerServicesSection") || document.querySelector('#nobrokerHubSearchInput')) return;

    const categoryPhotoMap = {
        "door-open": "/shared/images/services/service-door.svg",
        "screwdriver-wrench": "/shared/images/services/service-drill.svg",
        "box": "/shared/images/services/service-cupboard.svg",
        "table-cells-large": "/shared/images/services/service-window.svg",
        "bed": "/shared/images/services/service-bed.svg",
        "chair": "/shared/images/services/service-furniture.svg",
        "archway": "/shared/images/services/service-wardrobe.svg",
        "user-gear": "/shared/images/services/service-carpenter.svg",
        "tv": "/shared/images/services/service-tv.svg",
        "house": "/shared/images/services/service-balcony.svg"
    };

    function getCategoryPhoto(icon) {
        return categoryPhotoMap[icon] || "/shared/images/services/furniture.jpg";
    }

    function getServiceRealPhoto(serviceName, categoryIcon) {
        const s = String(serviceName ?? "").toLowerCase().trim();

        if (s.includes("lock") || s.includes("bolt") || s.includes("latch")) return "/shared/images/services/service-door.svg";
        if (s.includes("drill") || s.includes("hole")) return "/shared/images/services/service-drill.svg";
        if (s.includes("accessory") || s.includes("stopper") || s.includes("hinge") || s.includes("hanger")) return "/shared/images/services/service-window.svg";
        if (s.includes("bed") || s.includes("cot") || s.includes("bunk") || s.includes("hydraulic")) return "/shared/images/services/service-bed.svg";
        if (s.includes("wardrobe") || s.includes("cabinet") || s.includes("shelf") || s.includes("rack") || s.includes("bookcase")) return "/shared/images/services/service-wardrobe.svg";
        if (s.includes("tv")) return "/shared/images/services/service-tv.svg";
        if (s.includes("table") || s.includes("chair") || s.includes("sofa") || s.includes("desk") || s.includes("bench") || s.includes("furniture")) return "/shared/images/services/service-furniture.svg";
        
        return getCategoryPhoto(categoryIcon);
    }

    // Shared presentation; existing booking forms and their persistence handlers remain in place.
    const groups = [
        ["Door", "door-open", [["Door Lock",174],["Wooden Door Repair",193],["Accessory Installation",96],["Sliding Door Repair",290],["Door Hinge Installation",237],["Overhead Door Closure",174],["Door Dismantling",248],["Wooden Door Installation",775],["Wall Mounted Door Closure",174],["Stopper Repair",67],["Tower Bolt Repair",128],["Mesh Door Services",290]]],
        ["Drill & hang", "screwdriver-wrench", [["Drill (Per Hole)",96],["Wooden Shelf Installation",145],["Bathroom Mirror Installation",115],["Towel Rod Installation",125],["Glass Shelf Installation",115],["Bath Fittings Installation",145]]],
        ["Cupboard and Drawer", "box", [["Channel Installation / Replacement",126],["Channel Repair",154],["Cupboard Hinge Repair / Replacement",96],["Cupboard Sliding Door Repair",261],["Cupboard Handle Installation / Replacement",86],["Cupboard Lock & Latches",96]]],
        ["Windows & curtain", "table-cells-large", [["Curtain Rod Installation",145],["Window Closing (Post-AC Removal)",96],["Window AC Frame Installation",339],["Shower Curtain Rod Installation",145],["Window Hinge Installation",145],["Window Misalignment / Jam Repair",193],["Blind Fitting",145]]],
        ["Bed", "bed", [["Cot Assembly",387],["Bed Support Repair",242],["Headboard Repair",125],["Loft Bed / Bunk Bed Assembly",901],["Single Bed Assembly",436],["Double Bed Assembly",581],["Day Bed / Diwan Assembly",533],["Hydraulic Bed Assembly",1260]]],
        ["Furniture Assembly", "chair", [["Study / Workspace Table Assembly",436],["Table / Chair Wheel Fitting",48],["Plastic Buffer Installation",48],["Magazine / Newspaper Rack Assembly",290],["Utensil Rack Assembly",261],["Wall Cabinet Assembly",242],["Shoe Cabinet Assembly",290],["Office Chair Assembly",242],["Bookcase Assembly",242],["Cabinet Assembly",484],["Sofa Assembly",436],["Shelving Unit Assembly",193],["TV Unit Bench Assembly",678],["Modular Sofa Assembly",533],["Dining Table with Chairs Assembly",678],["Swing Chair Assembly",436],["TV Bench Assembly",436],["Wooden Dining Table Assembly",339],["Recliner Assembly",387],["Dining Chair Assembly",193],["Extendable Dining Table Assembly",484],["Bar Table with Chairs Assembly",678],["Coffee Table Assembly",261],["Mandir Assembly",193]]],
        ["Wardrobe", "archway", [["Single Door Wardrobe Assembly",581],["Double Door Wardrobe Assembly",824],["Three Door Wardrobe Assembly",921],["Four Door Wardrobe Assembly",1018],["Sliding Door Wardrobe Assembly",775]]],
        ["Book a Carpenter", "user-gear", [["Carpenter Inspection",48]]],
        ["TV", "tv", [["TV Installation",727],["TV Uninstallation",339]]],
        ["Balcony", "house", [["Ceiling Mounted Hanger Installation",624],["Wall / Door Hanger Installation",115]]]
    ];
    const variants = {"Door Lock":[["Door Lock Repair",174],["Door Lock Installation",678],["Door Lock Replacement",261]]};
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const money = value => `₹${value.toLocaleString("en-IN")}`;
    const cart = new Map();
    let root, dialog, lastFocus;
    function init() {
        if (document.getElementById("nobrokerServicesSection") || document.getElementById("customerNoBrokerServicesSection") || document.querySelector('#nobrokerHubSearchInput')) return;
        const panel = document.querySelector('[data-view="services"]');
        if (!panel || document.getElementById("carpentryCatalogue")) return;
        if (panel.querySelector('#nobrokerHubSearchInput') || panel.id === "nobrokerServicesSection" || panel.id === "customerNoBrokerServicesSection") {
            return;
        }
        const resident = !!panel.querySelector('#noBrokerBookingForm');
        const style = document.createElement("link");
        style.rel = "stylesheet"; style.href = "/shared/css/carpentry-catalogue.css?v=8"; document.head.appendChild(style);
        root = document.createElement("div"); root.id = "carpentryCatalogue";
        root.innerHTML = `<div class="cc-hero"><label class="cc-search"><span>Search services</span><input type="search" placeholder="Search door, curtain, furniture…" aria-label="Search carpentry services"></label><div class="cc-intro"><div><p class="cc-eyebrow">HOME SERVICES · BANGALORE</p><h2>Carpenter services at your doorstep</h2><p>Choose a repair, installation or furniture assembly service.</p><div class="cc-categories">${groups.map(([name,icon],i)=>`<button type="button" data-category="${i}" ${i>6?'hidden':''}><span class="cc-img-tile"><img class="cc-real-img" src="${getCategoryPhoto(icon)}" alt="${escape(name)}" loading="lazy" /></span><span>${escape(name)}</span></button>`).join("")}<button type="button" data-more aria-expanded="false"><b>⌄</b><span>Show more</span></button></div></div><aside class="cc-promo"><span class="cc-promo-img-tile"><img class="cc-real-img" src="${getCategoryPhoto('screwdriver-wrench')}" alt="Carpenter services" loading="lazy" /></span><h3>Small repairs.<br>Comfortable homes.</h3><p>Select your service, share your address and choose a visit time.</p><button type="button" data-bookings>My bookings</button></aside></div></div><div class="cc-content"><div class="cc-service-list">${groups.map(([name,icon,services],i)=>`<section class="cc-group" id="cc-group-${i}"><header><span class="cc-header-img-tile"><img class="cc-real-img" src="${getCategoryPhoto(icon)}" alt="${escape(name)}" loading="lazy" /></span><h3>${escape(name)}</h3></header>${services.map(([service,price],j)=>`<article data-search="${escape((name+' '+service).toLowerCase())}"><div><h4>${escape(service)}</h4><strong>${variants[service]?'Starts at ':''}${money(price)}</strong><p>${escape(name)} service. Materials and additional work are quoted separately.</p><button type="button" class="cc-details" data-details="${i}:${j}">View details ›</button></div><div class="cc-item-action"><span class="cc-item-img-tile"><img class="cc-real-img" src="${getServiceRealPhoto(service, icon)}" alt="${escape(service)}" loading="lazy" /></span><button type="button" data-add="${i}:${j}">Add</button>${variants[service]?`<small>${variants[service].length} options</small>`:''}</div></article>`).join('')}</section>`).join('')}<p class="cc-empty" hidden>No services match your search.</p></div><aside class="cc-cart"><h3>Your services</h3><div data-cart></div><p class="cc-price-note">Indicative labour prices. Your vendor confirms the final quote before work starts.</p><button type="button" class="cc-primary" data-checkout disabled>Continue to booking</button><p role="status" data-feedback></p></aside></div><section class="cc-faq"><h3>Frequently asked questions</h3>${[
            ['How do I book?','Add the services you need, review your selection and complete the contact, address and visit details below.'],
            ['Are materials included?','Spare parts and materials are separate. Ask your assigned vendor to confirm any additional costs before starting.'],
            ['Is my selected time confirmed?','Your selected time is a request. Availability must be confirmed by the assigned vendor.'],
            ['Where can I track the request?','Open My bookings to see saved service requests and their latest status.'],
            ['What warranty applies?','Ask your assigned vendor to confirm the warranty for the agreed scope of work.']
        ].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
        // Keep the user's previous sections available in source, with their forms active below the catalogue.
        if (resident) {
            const booking = panel.querySelector('#noBrokerBookingForm');
            for (const child of Array.from(panel.children)) {
                if (!child.contains(booking) && !child.querySelector('#noBrokerMaintenanceRows') && !child.textContent.includes('My NoBroker-Style Service Bookings')) child.hidden = true;
            }
        } else {
            panel.querySelectorAll('.common-maintenance-hero,.common-maintenance-kpis,.common-maintenance-cats,.common-maintenance-grid').forEach(el => {el.hidden = true; el.style.display = 'none';});
        }
        panel.prepend(root);
        dialog = document.createElement('dialog'); dialog.className = 'cc-dialog'; document.body.appendChild(dialog);
        dialog.addEventListener('close',()=>lastFocus?.focus());
        dialog.addEventListener('click', event => {
            if (event.target.closest('[data-close]')) dialog.close();
            const option = event.target.closest('[data-option]');
            if (option) {add(option.dataset.option, Number(option.dataset.price)); dialog.close();}
        });
        root.addEventListener('input', event => {
            if (event.target.type !== 'search') return;
            const query = event.target.value.trim().toLowerCase();
            root.querySelectorAll('[data-search]').forEach(el => {el.hidden = !el.dataset.search.includes(query);});
            root.querySelectorAll('.cc-group').forEach(el => {el.hidden = !el.querySelector('[data-search]:not([hidden])');});
            root.querySelector('.cc-empty').hidden = !!root.querySelector('.cc-group:not([hidden])');
        });
        root.addEventListener('click', event => {
            const button = event.target.closest('button'); if (!button) return;
            if (button.hasAttribute('data-more')) {const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));root.querySelectorAll('[data-category]').forEach((el,i)=>{if(i>6)el.hidden=!expanded;});button.querySelector('span').textContent=expanded?'Show less':'Show more';}
            if (button.hasAttribute('data-category')) document.getElementById(`cc-group-${button.dataset.category}`)?.scrollIntoView({behavior:'smooth',block:'start'});
            if (button.dataset.add || button.dataset.details) {
                const [i,j]=(button.dataset.add || button.dataset.details).split(':').map(Number);const [name,price]=groups[i][2][j];
                if (button.dataset.details || variants[name]) details(name,price,button); else add(name,price);
            }
            if (button.dataset.quantity) {const item=cart.get(button.dataset.quantity);item.quantity+=Number(button.dataset.delta);if(item.quantity<=0)cart.delete(button.dataset.quantity);renderCart();}
            if(button.hasAttribute('data-checkout')) checkout(resident);
            if(button.hasAttribute('data-bookings')) (document.getElementById('noBrokerMaintenanceRows')?.closest('.card') || document.querySelector('.common-maintenance-table-card') || document.querySelector('#noBrokerBookingForm'))?.scrollIntoView({behavior:'smooth',block:'start'});
        });
        renderCart();
        if (location.hash === '#home-services') window.forceOpenPanel?.('services');
    }
    function add(name,price) {const item=cart.get(name)||{price,quantity:0};item.quantity++;cart.set(name,item);renderCart();}
    function renderCart() {
        root.querySelector('[data-cart]').innerHTML=cart.size?Array.from(cart,([name,item])=>`<div class="cc-cart-line"><strong>${escape(name)}</strong><div><span>${money(item.price*item.quantity)}</span><div class="cc-stepper"><button type="button" aria-label="Remove one ${escape(name)}" data-quantity="${escape(name)}" data-delta="-1">−</button><span>${item.quantity}</span><button type="button" aria-label="Add one ${escape(name)}" data-quantity="${escape(name)}" data-delta="1">+</button></div></div></div>`).join('')+`<p class="cc-total">Estimated total <strong>${money(Array.from(cart.values()).reduce((sum,item)=>sum+item.price*item.quantity,0))}</strong></p>`:'<p>Your selection is empty. Add a service to get started.</p>';
        root.querySelector('[data-checkout]').disabled=!cart.size;
    }
    function details(name,price,button) {
        lastFocus=button;dialog.innerHTML=`<button type="button" class="cc-close" data-close aria-label="Close service details">×</button><h2>${escape(name)}</h2><p>Select your service</p>${(variants[name]||[[name,price]]).map(([option,cost])=>`<div class="cc-option"><div><h3>${escape(option)}</h3><strong>${money(cost)}</strong><p>Labour estimate for one service unit.</p></div><button type="button" data-option="${escape(option)}" data-price="${cost}">Add</button></div>`).join('')}<h3>Service details</h3><p>The vendor assesses the item, confirms the scope and carries out the agreed repair or installation. Please provide the dimensions and current condition in your booking notes.</p><h3>Not included</h3><p>Replacement materials, painting, custom fabrication and additional work require a separate quote.</p>`;dialog.showModal();
    }
    function checkout(resident) {
        const total=Array.from(cart.values()).reduce((sum,item)=>sum+item.price*item.quantity,0);
        const description=Array.from(cart,([name,item])=>`${name} × ${item.quantity}: ${money(item.price*item.quantity)}`).join('\n');
        if (resident) {
            window.selectNoBrokerService?.('Carpentry service booking',total);
            const form=document.getElementById('noBrokerBookingForm');
            const notes=form?.querySelector('textarea');if(notes)notes.value=description+'\nEstimated labour total: '+money(total)+'\n';
            form?.scrollIntoView({behavior:'smooth',block:'start'});
        } else {
            const form=document.getElementById('commonMaintenanceBookingForm');if(!form)return;
            form.elements.description.value=description+'\nEstimated labour total: '+money(total);
            form.elements.serviceCategory.value='Carpentry';
            const selectedName = cart.size === 1 ? Array.from(cart.keys())[0] : 'Carpentry service booking';
            let option = Array.from(form.elements.serviceType.options).find(item => item.value === selectedName);
            if (!option) { option = new Option(selectedName,selectedName); form.elements.serviceType.add(option); }
            form.elements.serviceType.value=selectedName;
            form.elements.selectedIndex.value='1';
            form.dataset.cartPrice = `Rs. ${total}`;
            form.elements.serviceOption.value='Standard service visit';
            form.scrollIntoView({behavior:'smooth',block:'start'});
        }
        root.querySelector('[data-feedback]').textContent='Selection added to the booking form. Complete your contact and visit details to submit.';
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
