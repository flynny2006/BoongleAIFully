
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LeftArrowIcon from './icons/LeftArrowIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import { usePlan, PlanTier } from '../hooks/usePlan'; // New import

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { plan: currentPlan, setPlan, claimProWithCode } = usePlan();
  const [claimCode, setClaimCode] = useState('');
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const plansConfig: Array<{name: string, id: PlanTier, price: string, priceSuffix: string, features: string[], ctaBase: string, color: string, isPopular: boolean}> = [
    {
      name: 'FREE',
      id: 'FREE',
      price: '$0',
      priceSuffix: '/ month',
      features: [
        '10 Credits daily',
        'Publish up to 5 Websites',
        'AI Software Engineer Badge on first 14 days (can be removed with PRO)',
      ],
      ctaBase: 'Get Started',
      color: 'blue',
      isPopular: false,
    },
    {
      name: 'PRO',
      id: 'PRO',
      price: '$4.99',
      priceSuffix: '/ month',
      features: [
        '500 Credits monthly',
        'Publish up to 15 Websites',
        'No AI Software Engineer Badge',
        'Create a Referral link. If you invite one friend / person which registered an account gets you +5 extra Credits.',
      ],
      ctaBase: 'Choose Pro',
      color: 'purple',
      isPopular: true,
    },
    {
      name: 'PREMIUM',
      id: 'PREMIUM',
      price: '$9.99',
      priceSuffix: '/ month',
      features: [
        'Everything in Pro',
        'Unlimited Credits',
        'Unlimited Published Sites',
        'Pro Subscription for a friend (1 week)',
      ],
      ctaBase: 'Go Premium',
      color: 'green',
      isPopular: false,
    },
  ];

  const getButtonClass = (color: string, isActive: boolean) => {
    if (isActive) {
      return 'bg-gray-500 cursor-default';
    }
    switch (color) {
      case 'blue': return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      case 'purple': return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
      case 'green': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      default: return 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500';
    }
  };

  const handlePlanSelect = (selectedPlanId: PlanTier) => {
    if (currentPlan !== selectedPlanId) {
      setPlan(selectedPlanId);
      setClaimMessage({type: 'success', text: `Successfully switched to ${selectedPlanId} plan!`});
      setTimeout(() => setClaimMessage(null), 3000);
    }
  };
  
  const getPlanButtonText = (planId: PlanTier, ctaBase: string): string => {
    if (currentPlan === planId) return "Current Plan";
    
    const planOrder: PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];
    const currentIndex = planOrder.indexOf(currentPlan);
    const selectedIndex = planOrder.indexOf(planId);

    if (selectedIndex < currentIndex) return `Downgrade to ${planId}`;
    return ctaBase; // Or "Upgrade to..."
  };

  const handleClaimCode = () => {
    if (claimProWithCode(claimCode)) {
      setClaimMessage({ type: 'success', text: 'PRO plan claimed successfully!' });
      setClaimCode('');
    } else {
      setClaimMessage({ type: 'error', text: 'Invalid claim code.' });
    }
    setTimeout(() => setClaimMessage(null), 3000);
  };


  return (
    <div className="min-h-screen bg-black text-white p-4 pt-10 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-10 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)} // Go back to previous page
            title="Back"
            className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex items-center"
            aria-label="Back"
          >
            <LeftArrowIcon className="w-5 h-5 mr-2" />
            Back
          </button>
           <h1 className="text-3xl md:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 flex-grow">
            Choose Your Plan
          </h1>
          <div className="w-auto" style={{minWidth: "100px"}}></div> {/* Spacer for true centering of title */}
        </div>

        {/* Claim Code Section */}
        <div className="mb-10 p-6 bg-gray-800 rounded-lg shadow-xl max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-3 text-center text-purple-400">Have a Claim Code?</h2>
          {claimMessage && (
            <p className={`mb-3 p-2 rounded text-sm text-center ${claimMessage.type === 'success' ? 'bg-green-700 text-green-200' : 'bg-red-700 text-red-200'}`}>
              {claimMessage.text}
            </p>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.trim())}
              placeholder="Enter code (e.g., 3636)"
              className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
            <button
              onClick={handleClaimCode}
              disabled={!claimCode}
              className="p-3 bg-yellow-500 hover:bg-yellow-600 rounded text-black font-semibold transition-colors disabled:bg-gray-600 disabled:text-gray-400"
            >
              Claim
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plansConfig.map((planItem) => (
            <div 
              key={planItem.id} 
              className={`relative flex flex-col bg-gray-800 p-6 rounded-2xl shadow-2xl border ${planItem.isPopular && currentPlan !== planItem.id ? 'border-purple-500' : 'border-gray-700'} ${currentPlan === planItem.id ? 'ring-2 ring-offset-2 ring-offset-black ring-purple-500' : ''} transform hover:scale-105 transition-all duration-200 ease-in-out`}
            >
              {planItem.isPopular && currentPlan !== planItem.id && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full shadow-md">
                  Most Popular
                </div>
              )}
              <h2 className={`text-2xl font-semibold mb-2 text-center ${currentPlan === planItem.id ? 'text-purple-300' : (planItem.color === 'blue' ? 'text-blue-400' : planItem.color === 'purple' ? 'text-purple-400' : 'text-green-400')}`}>
                {planItem.name}
              </h2>
              <div className="text-center mb-6">
                <span className="text-4xl font-extrabold text-white">{planItem.price}</span>
                <span className="text-gray-400 text-sm">{planItem.priceSuffix}</span>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300 flex-grow">
                {planItem.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start">
                    <CheckCircleIcon className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 ${currentPlan === planItem.id ? 'text-purple-400' : (planItem.color === 'blue' ? 'text-blue-500' : planItem.color === 'purple' ? 'text-purple-500' : 'text-green-500')}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => handlePlanSelect(planItem.id)}
                disabled={currentPlan === planItem.id}
                className={`w-full mt-auto p-3 font-semibold text-white rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-75 ${getButtonClass(planItem.color, currentPlan === planItem.id)}`}
              >
                {getPlanButtonText(planItem.id, planItem.ctaBase)}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 mt-12 text-sm">
          All prices are in USD. Plans are for illustrative purposes only. Manage your plan via localStorage.
        </p>
      </div>
    </div>
  );
};

export default PricingPage;
