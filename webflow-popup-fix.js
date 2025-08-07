// Webflow Popup Fix Script
// Run this in browser console to fix the popup positioning

function fixBRICSPopup() {
    console.log('🎯 Fixing BRICS popup positioning...');
    
    // Target the specific pop-up-buy-brics popup
    const bricsPopup = document.querySelector('.pop-up-buy-brics');
    if (bricsPopup) {
        console.log('✅ Found BRICS popup, fixing positioning...');
        
        // Reset any previous forced positioning
        bricsPopup.style.position = '';
        bricsPopup.style.top = '';
        bricsPopup.style.left = '';
        bricsPopup.style.transform = '';
        bricsPopup.style.zIndex = '';
        bricsPopup.style.backgroundColor = '';
        bricsPopup.style.border = '';
        bricsPopup.style.padding = '';
        bricsPopup.style.borderRadius = '';
        bricsPopup.style.minWidth = '';
        bricsPopup.style.minHeight = '';
        bricsPopup.style.boxShadow = '';
        
        // Make it visible with proper viewport containment
        bricsPopup.style.display = 'block';
        bricsPopup.style.visibility = 'visible';
        bricsPopup.style.opacity = '1';
        
        // Use fixed positioning but ensure it's within viewport
        bricsPopup.style.position = 'fixed';
        bricsPopup.style.top = '50%';
        bricsPopup.style.left = '50%';
        bricsPopup.style.transform = 'translate(-50%, -50%)';
        bricsPopup.style.zIndex = '999999';
        
        // Ensure it doesn't exceed viewport
        bricsPopup.style.maxWidth = '90vw';
        bricsPopup.style.maxHeight = '90vh';
        bricsPopup.style.overflow = 'auto';
        
        // Add Webflow classes
        bricsPopup.classList.add('w--open');
        bricsPopup.classList.add('w--current');
        
        console.log('✅ BRICS popup should now be properly positioned and visible!');
        return true;
    }
    
    console.log('❌ BRICS popup not found');
    return false;
}

// Auto-trigger popup after 5 seconds of inactivity
let inactivityTimer;
let popupShown = false;

function triggerBRICSPopup() {
    console.log('🎯 Auto-triggering BRICS popup...');
    
    if (fixBRICSPopup()) {
        popupShown = true;
    }
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (!popupShown) {
        inactivityTimer = setTimeout(triggerBRICSPopup, 5000); // 5 seconds
    }
}

// Reset timer on user activity
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('scroll', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);

// Start timer when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Auto-popup script loaded, starting 5-second timer for BRICS popup...');
    resetInactivityTimer();
});

// Also try when Webflow is ready
if (window.Webflow) {
    window.Webflow.push(() => {
        console.log('Webflow ready, starting popup timer...');
        resetInactivityTimer();
    });
}

// Export for manual testing
window.fixBRICSPopup = fixBRICSPopup;
window.triggerBRICSPopup = triggerBRICSPopup; 